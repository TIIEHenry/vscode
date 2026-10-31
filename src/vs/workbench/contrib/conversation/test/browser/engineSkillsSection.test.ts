/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { CancellationError, errorHandler, isCancellationError, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentExpectedOwner } from '../../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentCapabilitySnapshot,
	UniverseAgentListSkillsResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { EngineSkillsSection } from '../../browser/engineSkillsSection.js';
import { engineWriteNotSentCopy, engineWriteUnconfirmedCopy } from '../../browser/engineWriteGate.js';
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy } from '../../browser/engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { getSkillsUnsupportedCopy } from '../../browser/engineSkillCatalog.js';
import { localize } from '../../../../../nls.js';

const SKILLS_FEATURE = localize('ua.engineSkillsFeatureLabel', "a skills API");
const SKILLS_EMPTY_COPY = localize('ua.engineSkillsEmpty', "No skills yet.");
const LEFTOVER_SKILL_BODY = '# Leftover skill body';
const INFLIGHT_LIVE_SKILL_BODY = '# Inflight live skill body';

suite('EngineSkillsSection (E1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		skillsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		looksLive?: boolean;
		listSkills?: IUniverseAgentConnection['listSkills'];
		getSkillInfo?: IUniverseAgentConnection['getSkillInfo'];
		saveSkillContent?: NonNullable<IUniverseAgentConnection['saveSkillContent']>;
		setSkillEnabled?: IUniverseAgentConnection['setSkillEnabled'];
	} = {}): IUniverseAgentConnection & {
		setPublishedLink(identity: string, link: number): void;
		setPublishedLinkQuiet(identity: string, link: number): void;
		setConnected(value: boolean): void;
		setPairingPending(value: boolean): void;
		setPairingPendingQuiet(value: boolean): void;
		setLooksLive(value: boolean): void;
		setSkillsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
	} {
		const skillsCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'; reason: string } = {
			support: options.skillsSupport ?? 'UNSUPPORTED',
			reason: 'UNIMPLEMENTED',
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			skills: skillsCapability,
		};
		let connected = options.connected ?? false;
		let pairingPending = false;
		let looksLive = options.looksLive ?? false;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();

		let engineIdentityId = 'engine-test';
		let linkId = 1;
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			authenticated: connected,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities, engineIdentityId, linkId,
		});

		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getTransportState: () => (connected ? 'ok' : 'idle'),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			onDidFileMutation: Event.None,
			onDidTurnSettle: Event.None,
			onDidChangeTeamRuntime: Event.None,
			requestAgentTreeRefresh: () => { },
			getNavigatorCapability: () => 'UNKNOWN' as const,
			isAgentTreeFetchFailed: () => false,
			team: {
				memberStatus: async () => [],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			confirmPairing: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			cancelPairing: async () => { },
			probeConnectionProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { connected = false; onDidChangeConnection.fire(snapshot()); },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			renameSession: async () => ({ ok: false, message: 'stub' }),
			cancelGeneration: async () => ({ ok: false, message: 'stub' }),
			enqueueQueueItem: async () => ({ ok: false, error: 'stub' }),
			pauseQueue: async () => ({ ok: false, error: 'stub' }),
			resumeQueue: async () => ({ ok: false, error: 'stub' }),
			clearQueue: async () => ({ ok: false, error: 'stub' }),
			holdQueueItem: async () => ({ ok: false, error: 'stub' }),
			releaseQueueItemHold: async () => ({ ok: false, error: 'stub' }),
			editQueueItem: async () => ({ ok: false, error: 'stub' }),
			getHistory: async () => ({ envelopes: [] }),
			subscribeSessionEventStream: (
				_sessionId: string,
				_listener: (event: UniverseAgentSessionEvent) => void,
				_onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
			) => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: options.listSkills ?? (async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			})),
			setSkillEnabled: options.setSkillEnabled ?? (async () => ({ ok: true })),
			getSkillInfo: options.getSkillInfo ?? (async () => ({ name: 'demo-skill', content: '# Demo', source: 'bundled', enabled: true })),
			saveSkillContent: options.saveSkillContent ?? (async () => ({ ok: true })),
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
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setPublishedLink(identity: string, link: number) { engineIdentityId = identity; linkId = link; onDidChangeConnection.fire(snapshot()); },
			setPublishedLinkQuiet(identity: string, link: number) { engineIdentityId = identity; linkId = link; },
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
			setPairingPending(value: boolean) {
				pairingPending = value;
				onDidChangeConnection.fire(snapshot());
			},
			setPairingPendingQuiet(value: boolean) {
				pairingPending = value;
			},
			setLooksLive(value: boolean) {
				looksLive = value;
			},
			setSkillsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				skillsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountSection(connection: IUniverseAgentConnection, dialog?: IDialogService): EngineSkillsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		if (dialog) { instantiationService.stub(IDialogService, dialog); }
		const section = store.add(instantiationService.createInstance(EngineSkillsSection, parent));
		section.layout(640, 400);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function assertSkillsFailedHonesty(section: EngineSkillsSection, errorMessage: string, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
	}

	function assertSkillsLeftoverFailedHonesty(section: EngineSkillsSection, errorMessage: string, expectedRows: number): void {
		assertSkillsFailedHonesty(section, errorMessage, expectedRows);
		const listContainer = section.getDomNode().querySelector('.engine-skills-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
	}

	function assertSkillsLeftoverUnknownHonesty(section: EngineSkillsSection, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!status.textContent?.includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
		const listContainer = section.getDomNode().querySelector('.engine-skills-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
	}

	function assertSkillsLeftoverPairingHonesty(section: EngineSkillsSection, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
		const listContainer = section.getDomNode().querySelector('.engine-skills-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
	}

	function leftoverBodyStatus(section: EngineSkillsSection): HTMLElement {
		const status = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		assert.ok(status);
		return status;
	}

	function leftoverBodyTextarea(section: EngineSkillsSection): HTMLTextAreaElement {
		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement;
		assert.ok(textarea);
		return textarea;
	}

	function assertLeftoverBodyEditorClosed(section: EngineSkillsSection): void {
		assert.ok(leftoverBodyTextarea(section).readOnly);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
	}

	function leftoverSkillsRowToggles(section: EngineSkillsSection): HTMLElement[] {
		return Array.from(section.getDomNode().querySelectorAll('.engine-skill-row .monaco-custom-toggle'));
	}

	function assertLeftoverSkillsRowTogglesClosed(section: EngineSkillsSection): void {
		const toggles = leftoverSkillsRowToggles(section);
		assert.ok(toggles.length > 0, 'KEEP leftover rows must paint toggle chrome');
		for (const toggle of toggles) {
			assert.strictEqual(toggle.getAttribute('aria-disabled'), 'true');
			assert.ok(toggle.classList.contains('disabled'));
		}
	}

	function assertLeftoverSkillsRowTogglesLive(section: EngineSkillsSection): void {
		const toggles = leftoverSkillsRowToggles(section);
		assert.ok(toggles.length > 0, 'live leftover rows must paint toggle chrome');
		for (const toggle of toggles) {
			assert.notStrictEqual(toggle.getAttribute('aria-disabled'), 'true');
			assert.ok(!toggle.classList.contains('disabled'));
		}
	}

	test('Skills: description stays beside the checkbox and the editor stays closed until a skill is selected', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async (): Promise<UniverseAgentListSkillsResult> => ({
				skills: [
					{ name: 'code-review', source: 'bundled', enabled: true, description: 'Review code for correctness' },
					{ name: 'plain', source: 'user', enabled: true, description: '   ' },
				],
			}),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		section.layout(640, 400);

		const rows = [...section.getDomNode().querySelectorAll('.monaco-list-row')] as HTMLElement[];
		const heights = rows.map(row => row.style.height);
		assert.ok(heights.every(height => height === '24px'));
		for (const row of rows) {
			assert.notStrictEqual(row.style.lineHeight, '48px');
		}

		const described = rows.find(row => row.textContent?.includes('code-review'));
		assert.ok(described);
		const description = described!.querySelector('.engine-skill-description') as HTMLElement;
		assert.strictEqual(description.style.display, '');
		assert.ok(description.textContent?.includes('Review code for correctness'));
		const plain = rows.find(row => row.querySelector('.engine-skill-name')?.textContent === 'plain');
		assert.ok(plain);
		assert.strictEqual((plain!.querySelector('.engine-skill-description') as HTMLElement).style.display, 'none');

		const bodyField = section.getDomNode().querySelector('.engine-skill-body-input')?.closest('.monaco-scrollable-element') as HTMLElement;
		assert.ok(bodyField);
		assert.strictEqual(bodyField.style.display, 'none');
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		assert.ok(bodyStatus.textContent?.includes(localize('ua.engineSkillBodyNoSelection', "Select a skill to read its content.")));
		assert.ok(section.isBodyEditorVisible());

		section.selectSkillForTest('code-review');
		assert.notStrictEqual(bodyField.style.display, 'none');
		await flushMicrotasks();
	});

	test('skill toggle action names describe the next enablement state', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async (): Promise<UniverseAgentListSkillsResult> => ({
				skills: [
					{ name: 'enabled-skill', source: 'bundled', enabled: true },
					{ name: 'disabled-skill', source: 'user', enabled: false },
				],
			}),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.layout(640, 400);
		const rows = [...section.getDomNode().querySelectorAll('.monaco-list-row')];
		const enabledToggle = rows.find(row => row.querySelector('.engine-skill-name')?.textContent === 'enabled-skill')?.querySelector('[role=checkbox]');
		const disabledToggle = rows.find(row => row.querySelector('.engine-skill-name')?.textContent === 'disabled-skill')?.querySelector('[role=checkbox]');
		assert.ok(enabledToggle);
		assert.ok(disabledToggle);
		assert.strictEqual(enabledToggle?.getAttribute('aria-label'), 'Disable enabled-skill');
		assert.strictEqual(disabledToggle?.getAttribute('aria-label'), 'Enable disabled-skill');
	});

	test('late listSkills after dispose does not paint skill rows', async () => {
		let releaseList: ((value: UniverseAgentListSkillsResult) => void) | undefined;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = instantiationService.createInstance(EngineSkillsSection, parent);
		section.setSectionActive(true);
		section.layout(640, 400);
		await flushMicrotasks();

		section.dispose();
		releaseList!({
			skills: [{ name: 'late-after-dispose', source: 'bundled', enabled: true }],
		});
		await flushMicrotasks();

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('late-after-dispose'));
	});

	test('disconnected hides skills section (§8.3 #5 honest empty)', async () => {
		const connection = createConnectionStub({ connected: false, skillsSupport: 'SUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getDomNode().style.display, 'none');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('UNSUPPORTED shows honest message without fake skill names (§8.3 #6)', async () => {
		const connection = createConnectionStub({ connected: true, skillsSupport: 'UNSUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'unsupported');
		assert.strictEqual(section.getListEntryCount(), 0);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.ok(status.textContent?.includes(getSkillsUnsupportedCopy('UNIMPLEMENTED')));
		assert.ok(!/copilot/i.test(section.getDomNode().textContent ?? ''));
	});

	test('disconnect clears RPC catalog rows (§8.3 #5)', async () => {
		const connection = createConnectionStub({ connected: true, skillsSupport: 'SUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);

		connection.setConnected(false);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().style.display, 'none');
	});

	test('connected phase with pairingPending keeps leftover catalog and paints not-connected', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assertSkillsLeftoverPairingHonesty(section, leftoverRows);

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('leftover-looks-live pairing-hold writes stay 0 unary', async () => {
		const saveCalls: UniverseAgentSaveSkillContentRequest[] = [];
		const toggleCalls: Array<{ skillName: string; enabled: boolean }> = [];
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] };
			},
			saveSkillContent: async (request) => {
				saveCalls.push(request);
				return { ok: true };
			},
			setSkillEnabled: async (request) => {
				toggleCalls.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;
		assert.strictEqual(section.canWrite(), true);
		connection.setLooksLive(true);
		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assert.strictEqual(section.getListEntryCount(), leftoverRows);
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.isWriteToolbarVisible(), false);
		assert.strictEqual(await section.createSkill({ skillName: 'should-not-create', content: '# Nope' }), false);
		await section.toggleSkillForTest('leftover-skill', false);
		assert.deepStrictEqual(saveCalls, []);
		assert.deepStrictEqual(toggleCalls, []);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
	});

	test('listSkills reject is failed with error status and no leftover catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				throw new Error('listSkills exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assertSkillsFailedHonesty(section, 'listSkills exploded', 0);
		assert.ok(!/demo-skill/i.test(section.getDomNode().textContent ?? ''));
	});

	test('successful load then refresh throw keeps leftover catalog and paints failed', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, 2);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		assert.strictEqual(section.getSelectedSkillBody(), '');
	});

	test('successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const listCallsAfterLoad = listSkillsCalls;

		connection.setSkillsSupport('UNKNOWN');
		await flushMicrotasks();

		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(section.getSelectedSkillBody(), '');
	});

	test('first fetch capability UNKNOWN is empty with capability loading', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'UNKNOWN',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(listSkillsCalls, 0);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!status.textContent?.includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
		assert.ok(!/demo-skill/i.test(section.getDomNode().textContent ?? ''));
	});

	test('SUPPORTED connected shows New toolbar and createSkill calls saveSkillContent RPC', async () => {
		let saveCalled = false;
		let savedSkillName = '';
		let savedContent = '';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'demo-skill', source: 'bundled', enabled: true },
					...(savedSkillName ? [{ name: savedSkillName, source: 'user' as const, enabled: true }] : []),
				],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: savedContent || '# New',
				source: request.skillName === 'demo-skill' ? 'bundled' : 'user',
				enabled: true,
			}),
			saveSkillContent: async (request) => {
				saveCalled = true;
				savedSkillName = request.skillName;
				savedContent = request.content;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isWriteToolbarVisible(), true);

		const ok = await section.createSkill({ skillName: 'my-new-skill', content: '# My New Skill\n\nBody.' });
		assert.ok(saveCalled);
		assert.strictEqual(savedSkillName, 'my-new-skill');
		assert.strictEqual(savedContent, '# My New Skill\n\nBody.');
		assert.strictEqual(ok, true);
	});

	test('disconnected createSkill does not call saveSkillContent RPC', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			skillsSupport: 'SUPPORTED',
			saveSkillContent: async () => {
				saveCalled = true;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		const ok = await section.createSkill({ skillName: 'should-not-create', content: '# Nope' });
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
		assert.strictEqual(section.isWriteToolbarVisible(), false);
	});

	test('createSkill ok:false paints write-status and does not add a fake row', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
			saveSkillContent: async () => ({ ok: false }),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.createSkill({ skillName: 'should-not-appear', content: '# Nope' });
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		const createFailed = localize('ua.engineSkillCreateFailed', "Could not create skill content on the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(createFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(createFailed));
		assert.deepStrictEqual([...writeStatus.classList], ['engine-skill-write-status', 'is-error']);
		assert.deepStrictEqual([...bodyStatus.classList], ['engine-skill-body-status', 'is-error']);
	});

	test('toggleSkill ok:false paints write-status and keeps catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			}),
			setSkillEnabled: async () => ({ ok: false }),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		await section.toggleSkillForTest('demo-skill', false);

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		const toggleFailed = localize('ua.engineSkillToggleFailed', "Could not update skill enablement on the engine.");
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(toggleFailed));
		assert.deepStrictEqual([...writeStatus.classList], ['engine-skill-write-status', 'is-error']);
	});

	test('toggleSkill throw paints write-status and keeps catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			}),
			setSkillEnabled: async () => {
				throw new Error('setSkillEnabled exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		await section.toggleSkillForTest('demo-skill', false);

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		const toggleFailed = localize('ua.engineSkillToggleFailed', "Could not update skill enablement on the engine.");
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(toggleFailed));
		assert.deepStrictEqual([...writeStatus.classList], ['engine-skill-write-status', 'is-error']);
	});

	test('toggleSkill success does not keep toggle-success when subsequent listSkills fails', async () => {
		let listSkillsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					listSkillsCalls++;
					if (listSkillsCalls > 1) {
						throw new Error('listSkills exploded');
					}
					return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
				},
				setSkillEnabled: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);

			await section.toggleSkillForTest('demo-skill', false);
			await flushMicrotasks();

			assert.ok(listSkillsCalls >= 2);
			const toggleSuccess = localize('ua.engineSkillToggleSuccess', "Updated.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.ok(!(writeStatus.textContent ?? '').includes(toggleSuccess));

			assertSkillsLeftoverFailedHonesty(section, 'listSkills exploded', 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('toggleSkill success still shows toggle-success when subsequent getSkillInfo fails', async () => {
		let getSkillInfoCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
				}),
				getSkillInfo: async (request) => {
					getSkillInfoCalls++;
					if (getSkillInfoCalls > 1) {
						throw new Error('getSkillInfo exploded');
					}
					return {
						name: request.skillName,
						content: '# Demo',
						source: 'bundled',
						enabled: true,
					};
				},
				setSkillEnabled: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			section.selectSkillForTest('demo-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
			assert.ok(getSkillInfoCalls >= 1);

			await section.toggleSkillForTest('demo-skill', false);
			await flushMicrotasks();

			assert.ok(getSkillInfoCalls >= 2);
			const toggleSuccess = localize('ua.engineSkillToggleSuccess', "Updated.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.notStrictEqual(writeStatus.style.display, 'none');
			assert.ok(writeStatus.textContent?.includes(toggleSuccess));
			assert.deepStrictEqual([...writeStatus.classList], ['engine-skill-write-status', 'is-success']);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('createSkill success does not keep create-success when subsequent listSkills fails', async () => {
		let listSkillsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					listSkillsCalls++;
					if (listSkillsCalls > 1) {
						throw new Error('listSkills exploded');
					}
					return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
				},
				saveSkillContent: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);

			await section.createSkill({ skillName: 'my-new-skill', content: '# My New Skill\n\nBody.' });
			await flushMicrotasks();

			assert.ok(listSkillsCalls >= 2);
			const createSuccess = localize('ua.engineSkillCreateSuccess', "Created.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.ok(!(writeStatus.textContent ?? '').includes(createSuccess));

			assertSkillsLeftoverFailedHonesty(section, 'listSkills exploded', 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('createSkill throw paints write-status and does not add a fake row', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
			saveSkillContent: async () => {
				throw new Error('saveSkillContent exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.createSkill({ skillName: 'should-not-appear', content: '# Nope' });
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		const createFailed = localize('ua.engineSkillCreateFailed', "Could not create skill content on the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(createFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(createFailed));
	});

	test('saveSelectedSkillBody ok:false paints write-status and keeps catalog', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'user-skill', source: 'user', enabled: true }] };
			},
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async () => ({ ok: false }),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('user-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.saveSelectedSkillBody('# should-not-persist');
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);

		const saveFailed = localize('ua.engineSkillBodySaveFailed', "Could not save skill content to the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(saveFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(saveFailed));
	});

	test('runtime SaveSkillContent UNIMPLEMENTED closes write chrome after binding disappears', async () => {
		let saveCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'user-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async () => {
				saveCalls++;
				connection.saveSkillContent = undefined;
				return { ok: false, reason: 'UNIMPLEMENTED' };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		section.selectSkillForTest('user-skill');
		await flushMicrotasks();

		assert.strictEqual(section.isWriteToolbarVisible(), true);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assert.strictEqual(await section.saveSelectedSkillBody('# should-not-persist'), false);
		assert.strictEqual(section.isWriteToolbarVisible(), false);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
		assert.strictEqual(await section.saveSelectedSkillBody('# second-attempt'), false);
		assert.strictEqual(saveCalls, 1);
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		assert.ok(bodyStatus.textContent?.includes('skill content write'));
	});

	test('saveSelectedSkillBody throw paints write-status and keeps catalog', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'user-skill', source: 'user', enabled: true }] };
			},
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async () => {
				throw new Error('saveSkillContent exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('user-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.saveSelectedSkillBody('# should-not-persist');
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);

		const saveFailed = localize('ua.engineSkillBodySaveFailed', "Could not save skill content to the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes('Refresh to reload'));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(saveFailed));
	});

	test('saveSelectedSkillBody reads canonical body without refreshing the list', async () => {
		let listSkillsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					listSkillsCalls++;
					if (listSkillsCalls > 1) {
						throw new Error('listSkills exploded');
					}
					return { skills: [{ name: 'user-skill', source: 'user', enabled: true }] };
				},
				getSkillInfo: async (request) => ({
					name: request.skillName,
					content: '# Original',
					source: 'user',
					enabled: true,
				}),
				saveSkillContent: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			section.selectSkillForTest('user-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'user-skill');

			const ok = await section.saveSelectedSkillBody('# Updated body');
			await flushMicrotasks();
			assert.strictEqual(ok, true);
			assert.strictEqual(listSkillsCalls, 1);

			const saveSuccess = localize('ua.engineSkillBodySaveSuccess', "Saved.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.ok(writeStatus.textContent?.includes(saveSuccess));

			assert.strictEqual(section.getMode(), 'ready');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('saveSelectedSkillBody reports failure when canonical getSkillInfo fails', async () => {
		let getSkillInfoCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'user-skill', source: 'user', enabled: true }],
				}),
				getSkillInfo: async (request) => {
					getSkillInfoCalls++;
					if (getSkillInfoCalls > 1) {
						throw new Error('getSkillInfo exploded');
					}
					return {
						name: request.skillName,
						content: '# Original',
						source: 'user',
						enabled: true,
					};
				},
				saveSkillContent: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			section.selectSkillForTest('user-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
			assert.ok(getSkillInfoCalls >= 1);

			const ok = await section.saveSelectedSkillBody('# Updated body');
			await flushMicrotasks();
			assert.strictEqual(ok, false);
			assert.ok(getSkillInfoCalls >= 2);

			const saveSuccess = localize('ua.engineSkillBodySaveSuccess', "Saved.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.notStrictEqual(writeStatus.style.display, 'none');
			assert.ok(!writeStatus.textContent?.includes(saveSuccess));
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('SUPPORTED connected saveSelectedSkillBody calls saveSkillContent RPC', async () => {
		let saveCalled = false;
		let savedContent = '';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'user-skill', source: 'user', enabled: true }],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async (request) => {
				saveCalled = true;
				savedContent = request.content;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.canWrite(), true);
		assert.ok(section.isBodyEditorVisible());

		section.selectSkillForTest('user-skill');
		await flushMicrotasks();

		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement;
		assert.ok(textarea);
		assert.strictEqual(textarea.value, '# Original');
		assert.strictEqual(section.isSaveToolbarVisible(), true);

		textarea.value = '# Updated body';
		const ok = await section.saveSelectedSkillBody();
		assert.ok(saveCalled);
		assert.strictEqual(savedContent, '# Updated body');
		assert.strictEqual(ok, true);
	});

	test('save uses raw CAS and preserves typing during canonical readback', async () => {
		const gate = new DeferredPromise<{ ok: boolean }>();
		const requests: UniverseAgentSaveSkillContentRequest[] = [];
		let body = '';
		const connection = createConnectionStub({
			connected: true, skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'user-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => ({ name: 'user-skill', content: body, source: 'user', enabled: true }),
			saveSkillContent: async request => { requests.push(request); return requests.length === 1 ? gate.p : { ok: false }; },
		});
		const section = mountSection(connection);
		await flushMicrotasks(); section.selectSkillForTest('user-skill'); await flushMicrotasks();
		const textarea = section.getDomNode().querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = '# First'; textarea.dispatchEvent(new mainWindow.Event('input'));
		const saving = section.saveSelectedSkillBody();
		textarea.value = '# Newer draft'; textarea.dispatchEvent(new mainWindow.Event('input'));
		body = '---\nname: user-skill\n---\n# First';
		await gate.complete({ ok: true });
		assert.strictEqual(await saving, true);
		assert.strictEqual(textarea.value, '# Newer draft');
		assert.deepStrictEqual(requests[0], { skillName: 'user-skill', content: '# First', create: false, expectedSource: 'user', expectedContent: '' });
		assert.strictEqual(await section.saveSelectedSkillBody(), false);
		assert.deepStrictEqual(requests[1], { skillName: 'user-skill', content: '# Newer draft', create: false, expectedSource: 'user', expectedContent: body });
		assert.strictEqual(textarea.value, '# Newer draft');
	});

	test('late save from old link cannot replace a draft or authorize a new-engine save', async () => {
		const gate = new DeferredPromise<{ ok: boolean }>();
		let saves = 0;
		const connection = createConnectionStub({
			connected: true, skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'user-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => ({ name: 'user-skill', content: '# Original', source: 'user', enabled: true }),
			saveSkillContent: async () => { saves++; return gate.p; },
		});
		const section = mountSection(connection);
		await flushMicrotasks(); section.selectSkillForTest('user-skill'); await flushMicrotasks();
		const textarea = section.getDomNode().querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = '# Draft'; textarea.dispatchEvent(new mainWindow.Event('input'));
		const saving = section.saveSelectedSkillBody();
		connection.setPublishedLink('other-engine', 2); await flushMicrotasks();
		await gate.complete({ ok: true });
		assert.strictEqual(await saving, false);
		assert.strictEqual(textarea.value, '# Draft');
		assert.strictEqual(await section.saveSelectedSkillBody(), false);
		assert.strictEqual(saves, 1);
	});

	test('explicit refresh recovers CAS baseline after readback failure and keeps dirty draft', async () => {
		let body = '# Original'; let failReadback = false;
		const requests: UniverseAgentSaveSkillContentRequest[] = [];
		const connection = createConnectionStub({
			connected: true, skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'user-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => { if (failReadback) { throw new Error('lost readback'); } return { name: 'user-skill', content: body, source: 'user', enabled: true }; },
			saveSkillContent: async request => { requests.push(request); body = request.content; return { ok: true }; },
		});
		const section = mountSection(connection);
		await flushMicrotasks(); section.selectSkillForTest('user-skill'); await flushMicrotasks();
		const textarea = section.getDomNode().querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = '# Draft'; textarea.dispatchEvent(new mainWindow.Event('input'));
		failReadback = true;
		assert.strictEqual(await section.saveSelectedSkillBody(), false);
		textarea.value = '# Newer draft'; textarea.dispatchEvent(new mainWindow.Event('input'));
		assert.strictEqual(await section.saveSelectedSkillBody(), false);
		assert.strictEqual(requests.length, 1);
		failReadback = false;
		(section.getDomNode().querySelector('[aria-label="Refresh skills"]') as HTMLElement).click();
		await flushMicrotasks();
		assert.strictEqual(textarea.value, '# Newer draft');
		assert.strictEqual(await section.saveSelectedSkillBody(), true);
		assert.deepStrictEqual(requests[1], { skillName: 'user-skill', content: '# Newer draft', create: false, expectedSource: 'user', expectedContent: '# Draft' });
	});

	test('explicit Refresh recovers a dirty draft on a new link to the same engine', async () => {
		let request: UniverseAgentSaveSkillContentRequest | undefined;
		const connection = createConnectionStub({
			connected: true, skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'user-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => ({ name: 'user-skill', content: '# Original', source: 'user', enabled: true }),
			saveSkillContent: async value => { request = value; return { ok: true }; },
		});
		const section = mountSection(connection);
		await flushMicrotasks(); section.selectSkillForTest('user-skill'); await flushMicrotasks();
		const textarea = section.getDomNode().querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = '# Draft'; textarea.dispatchEvent(new mainWindow.Event('input'));
		connection.setPublishedLink('engine-test', 2); await flushMicrotasks();
		assert.strictEqual(await section.saveSelectedSkillBody(), false);
		(section.getDomNode().querySelector('[aria-label="Refresh skills"]') as HTMLElement).click(); await flushMicrotasks();
		assert.strictEqual(textarea.value, '# Draft');
		assert.strictEqual(await section.saveSelectedSkillBody(), true);
		assert.deepStrictEqual(request, { skillName: 'user-skill', content: '# Draft', create: false, expectedSource: 'user', expectedContent: '# Original' });
	});

	test('New dialog cannot create a skill on an engine switched while the dialog was open', async () => {
		const gate = new DeferredPromise<Awaited<ReturnType<IDialogService['input']>>>();
		let saves = 0;
		const connection = createConnectionStub({ connected: true, skillsSupport: 'SUPPORTED', saveSkillContent: async () => { saves++; return { ok: true }; } });
		const dialog = new TestDialogService(); dialog.input = () => gate.p;
		const section = mountSection(connection, dialog); await flushMicrotasks();
		(section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement).click();
		connection.setPublishedLink('other-engine', 2);
		await gate.complete({ confirmed: true, values: ['fresh'] }); await flushMicrotasks();
		assert.strictEqual(saves, 0);
		assert.ok((section.getDomNode().textContent ?? '').includes(engineWriteNotSentCopy()));
	});

	test('a connection event during New still creates the skill', async () => {
		const gate = new DeferredPromise<Awaited<ReturnType<IDialogService['input']>>>();
		let saves = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [] }),
			saveSkillContent: async () => { saves++; return { ok: true }; },
		});
		const dialog = new TestDialogService();
		dialog.input = () => gate.p;
		const section = mountSection(connection, dialog);
		await flushMicrotasks();
		(section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement).click();
		connection.setPublishedLink('engine-test', 1);
		await flushMicrotasks();
		await gate.complete({ confirmed: true, values: ['fresh'] });
		await flushMicrotasks();
		assert.strictEqual(saves, 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('Created.'));
	});

	test('create still shows success when a refresh is loading, and a link change shows unconfirmed', async () => {
		let lists = 0;
		let releaseStaleList: (() => void) | undefined;
		let releaseSave!: (value: { ok: true }) => void;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: () => {
				lists++;
				if (lists === 1 || lists >= 3) {
					return Promise.resolve({ skills: [] });
				}
				return new Promise(resolve => { releaseStaleList = () => resolve({ skills: [] }); });
			},
			saveSkillContent: () => new Promise(resolve => { releaseSave = resolve; }),
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		const creating = section.createSkill({ skillName: 'fresh', content: '# Fresh' });
		connection.setPublishedLink('engine-test', 1);
		await flushMicrotasks();
		releaseSave({ ok: true });
		assert.strictEqual(await creating, true);
		assert.ok((section.getDomNode().textContent ?? '').includes('Created.'));
		releaseStaleList?.();
		await flushMicrotasks();
		assert.ok((section.getDomNode().textContent ?? '').includes('Created.'));

		let releaseLate!: (value: { ok: true }) => void;
		connection.saveSkillContent = () => new Promise(resolve => { releaseLate = resolve; });
		const late = section.createSkill({ skillName: 'later', content: '# Later' });
		connection.setPublishedLink('other-engine', 2);
		releaseLate({ ok: true });
		assert.strictEqual(await late, false);
		await flushMicrotasks();
		assert.ok((section.getDomNode().textContent ?? '').includes(engineWriteUnconfirmedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Could not create skill content on the engine.'));
	});

	suite('disconnected draft ownership', () => {
		function bodyInput(section: EngineSkillsSection): HTMLTextAreaElement {
			const input = section.getDomNode().querySelector('textarea');
			assert.ok(input);
			return input;
		}

		function editBody(section: EngineSkillsSection, value: string): void {
			const input = bodyInput(section);
			input.value = value;
			input.dispatchEvent(new mainWindow.Event('input'));
		}

		async function refreshDraft(section: EngineSkillsSection): Promise<void> {
			const refresh = section.getDomNode().querySelector<HTMLElement>('[aria-label="Refresh skills"]');
			assert.ok(refresh);
			refresh.click();
			await flushMicrotasks();
		}

		function assertRetainedDraft(section: EngineSkillsSection, value: string): void {
			assert.deepStrictEqual({
				body: bodyInput(section).value,
				readOnly: bodyInput(section).readOnly,
				saveVisible: section.isSaveToolbarVisible(),
				bodyVisible: section.isBodyEditorVisible(),
			}, { body: value, readOnly: true, saveVisible: false, bodyVisible: true });
		}

		for (const source of ['user', 'project'] as const) {
			for (const draft of ['# Unsaved draft', '']) {
				test(`${source} ${draft ? 'edited' : 'empty'} draft survives a true disconnect and refreshes the original raw CAS`, async () => {
					let raw = '# Original';
					const requests: UniverseAgentSaveSkillContentRequest[] = [];
					const connection = createConnectionStub({
						connected: true, skillsSupport: 'SUPPORTED',
						listSkills: async () => ({ skills: [{ name: 'editable', source, enabled: true }] }),
						getSkillInfo: async () => ({ name: 'editable', content: raw, source, enabled: true }),
						saveSkillContent: async request => { requests.push(request); raw = request.content; return { ok: true }; },
					});
					const section = mountSection(connection);
					section.setSectionActive(true);
					await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
					editBody(section, draft);
					connection.setConnected(false); await flushMicrotasks();
					assertRetainedDraft(section, draft);
					assert.deepStrictEqual({ rows: section.getListEntryCount(), count: section.getItemCount(), canWrite: section.canWrite() }, { rows: 0, count: undefined, canWrite: false });
					assert.strictEqual(await section.saveSelectedSkillBody(), false);
					raw = '# Current engine raw';
					connection.setPublishedLink('engine-test', 2);
					connection.setConnected(true); await flushMicrotasks();
					assertRetainedDraft(section, draft);
					assert.strictEqual(await section.saveSelectedSkillBody(), false);
					assert.deepStrictEqual(requests, []);
					await refreshDraft(section);
					assert.deepStrictEqual({ body: bodyInput(section).value, readOnly: bodyInput(section).readOnly, saveVisible: section.isSaveToolbarVisible() }, { body: draft, readOnly: false, saveVisible: true });
					assert.strictEqual(await section.saveSelectedSkillBody(), true);
					assert.deepStrictEqual(requests, [{ skillName: 'editable', content: draft, create: false, expectedSource: source, expectedContent: '# Current engine raw' }]);
				});
			}
		}

		test('missing, changed-source, foreign-engine and failed reads keep the original draft isolated', async () => {
			let listKind: 'missing' | 'user' | 'project' = 'user';
			let raw = '# Original';
			let failRead = false;
			let readSource: 'user' | 'project' = 'user';
			let reads = 0;
			const requests: UniverseAgentSaveSkillContentRequest[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED',
				listSkills: async () => ({ skills: listKind === 'missing' ? [] : [{ name: 'editable', source: listKind, enabled: true }] }),
				getSkillInfo: async () => { reads++; if (failRead) { throw new Error('read failed'); } return { name: 'editable', content: raw, source: readSource, enabled: true }; },
				saveSkillContent: async request => { requests.push(request); return { ok: false }; },
			});
			const section = mountSection(connection);
			await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
			editBody(section, '# Draft');
			connection.setConnected(false);
			listKind = 'missing';
			connection.setPublishedLink('engine-test', 2); connection.setConnected(true); await flushMicrotasks();
			const initialReads = reads;
			await refreshDraft(section); assertRetainedDraft(section, '# Draft');
			listKind = 'project';
			await refreshDraft(section); assertRetainedDraft(section, '# Draft');
			assert.strictEqual(reads, initialReads);
			listKind = 'user';
			connection.setPublishedLink('other-engine', 3); await flushMicrotasks();
			await refreshDraft(section);
			section.selectSkillForTest('editable'); section.selectSkillGroupForTest('user');
			assertRetainedDraft(section, '# Draft');
			assert.strictEqual(await section.saveSelectedSkillBody(), false);
			assert.strictEqual(reads, initialReads);
			failRead = true;
			connection.setPublishedLink('engine-test', 4); await flushMicrotasks();
			await refreshDraft(section); assertRetainedDraft(section, '# Draft');
			assert.strictEqual(await section.saveSelectedSkillBody(), false);
			assert.deepStrictEqual(requests, []);
			failRead = false; readSource = 'project';
			await refreshDraft(section); assertRetainedDraft(section, '# Draft');
			assert.strictEqual(await section.saveSelectedSkillBody(), false);
			readSource = 'user'; raw = '# Recovered raw';
			await refreshDraft(section);
			assert.strictEqual(bodyInput(section).readOnly, false);
			assert.strictEqual(await section.saveSelectedSkillBody(), false);
			assert.deepStrictEqual(requests, [{ skillName: 'editable', content: '# Draft', create: false, expectedSource: 'user', expectedContent: raw }]);
		});

		for (const reason of ['UNKNOWN', 'UNSUPPORTED', 'list failure'] as const) {
			test(`${reason} retains a read-only draft until a successful explicit refresh`, async () => {
				let failList = false;
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async () => { if (failList) { throw new Error('catalog unavailable'); } return { skills: [{ name: 'editable', source: 'user', enabled: true }] }; },
					getSkillInfo: async () => ({ name: 'editable', content: '# Original', source: 'user', enabled: true }),
				});
				const section = mountSection(connection);
				await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
				editBody(section, '# Draft');
				if (reason === 'list failure') { failList = true; connection.setPublishedLink('engine-test', 1); }
				else { connection.setSkillsSupport(reason); }
				await flushMicrotasks(); assertRetainedDraft(section, '# Draft');
				assert.strictEqual(await section.saveSelectedSkillBody(), false);
				failList = false; connection.setSkillsSupport('SUPPORTED'); await flushMicrotasks();
				assertRetainedDraft(section, '# Draft');
				await refreshDraft(section);
				assert.deepStrictEqual({ body: bodyInput(section).value, readOnly: bodyInput(section).readOnly, saveVisible: section.isSaveToolbarVisible() }, { body: '# Draft', readOnly: false, saveVisible: true });
			});
		}

		for (const outcome of ['accepted', 'refused', 'rejected'] as const) {
			test(`pending old save ${outcome} cannot block reconnect recovery or release a newer save lock`, async () => {
				const oldSave = new DeferredPromise<{ ok: boolean }>();
				const newSave = new DeferredPromise<{ ok: boolean }>();
				const requests: UniverseAgentSaveSkillContentRequest[] = [];
				let raw = '# Original';
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async () => ({ skills: [{ name: 'editable', source: 'user', enabled: true }] }),
					getSkillInfo: async () => ({ name: 'editable', content: raw, source: 'user', enabled: true }),
					saveSkillContent: async request => { requests.push(request); return requests.length === 1 ? oldSave.p : requests.length === 2 ? newSave.p : { ok: false }; },
				});
				const section = mountSection(connection);
				await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
				editBody(section, '# First');
				const first = section.saveSelectedSkillBody();
				editBody(section, '# Original');
				assert.strictEqual(section.isSkillBodyDirty(), false, 'typing back to the old baseline still needs retention while saving');
				connection.setConnected(false); await flushMicrotasks();
				assertRetainedDraft(section, '# Original');
				raw = '# Reconnected raw';
				connection.setPublishedLink('engine-test', 2); connection.setConnected(true); await flushMicrotasks();
				await refreshDraft(section);
				assert.strictEqual(bodyInput(section).readOnly, false, 'recovery must not await the obsolete RPC');
				editBody(section, '# Second');
				const second = section.saveSelectedSkillBody();
				assert.strictEqual(requests.length, 2);
				if (outcome === 'rejected') { await oldSave.error(new Error('old link failed')); }
				else { await oldSave.complete({ ok: outcome === 'accepted' }); }
				assert.strictEqual(await first, false);
				assert.strictEqual(await section.saveSelectedSkillBody(), false, 'the old finally must not release the new save lock');
				assert.deepStrictEqual({ body: bodyInput(section).value, saves: requests.length }, { body: '# Second', saves: 2 });
				raw = '# Canonical second'; await newSave.complete({ ok: true });
				assert.strictEqual(await second, true);
				assert.strictEqual(bodyInput(section).value, raw);
				editBody(section, '# Third'); await section.saveSelectedSkillBody();
				assert.deepStrictEqual(requests[2], { skillName: 'editable', content: '# Third', create: false, expectedSource: 'user', expectedContent: '# Canonical second' });
			});
		}

		test('late canonical readback cannot replace a reconnected draft or its refreshed baseline', async () => {
			const oldRead = new DeferredPromise<{ name: string; content: string; source: 'user'; enabled: boolean }>();
			let reads = 0;
			const requests: UniverseAgentSaveSkillContentRequest[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED',
				listSkills: async () => ({ skills: [{ name: 'editable', source: 'user', enabled: true }] }),
				getSkillInfo: async () => { reads++; return reads === 2 ? oldRead.p : { name: 'editable', content: reads === 1 ? '# Original' : '# Reconnected raw', source: 'user', enabled: true }; },
				saveSkillContent: async request => { requests.push(request); return { ok: true }; },
			});
			const section = mountSection(connection);
			await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
			editBody(section, '# First'); const saving = section.saveSelectedSkillBody(); await flushMicrotasks();
			assert.strictEqual(reads, 2);
			editBody(section, '# Newer draft');
			connection.setConnected(false); connection.setPublishedLink('engine-test', 2); connection.setConnected(true); await flushMicrotasks();
			await refreshDraft(section);
			await oldRead.complete({ name: 'editable', content: '# Old canonical', source: 'user', enabled: true });
			assert.strictEqual(await saving, false);
			assert.strictEqual(bodyInput(section).value, '# Newer draft');
			assert.strictEqual(await section.saveSelectedSkillBody(), true);
			assert.deepStrictEqual(requests[1], { skillName: 'editable', content: '# Newer draft', create: false, expectedSource: 'user', expectedContent: '# Reconnected raw' });
		});

		test('a late old server write causes an honest CAS refusal and explicit refresh recovery', async () => {
			const oldWrite = new DeferredPromise<void>();
			const currentWrite = new DeferredPromise<void>();
			let raw = '# Original';
			let writes = 0;
			const requests: UniverseAgentSaveSkillContentRequest[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED',
				listSkills: async () => ({ skills: [{ name: 'editable', source: 'user', enabled: true }] }),
				getSkillInfo: async () => ({ name: 'editable', content: raw, source: 'user', enabled: true }),
				saveSkillContent: async request => {
					requests.push(request); const write = ++writes;
					if (write === 1) { await oldWrite.p; }
					if (write === 2) { await currentWrite.p; }
					if (request.create || request.expectedContent !== raw) { return { ok: false }; }
					raw = request.content; return { ok: true };
				},
			});
			const section = mountSection(connection);
			await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
			editBody(section, '# Old write'); const first = section.saveSelectedSkillBody();
			connection.setConnected(false); connection.setPublishedLink('engine-test', 2); connection.setConnected(true); await flushMicrotasks();
			await refreshDraft(section); editBody(section, '# Current draft'); const second = section.saveSelectedSkillBody();
			await oldWrite.complete(); assert.strictEqual(await first, false);
			await currentWrite.complete(); assert.strictEqual(await second, false);
			assert.deepStrictEqual({ body: bodyInput(section).value, dirty: section.isSkillBodyDirty(), server: raw }, { body: '# Current draft', dirty: true, server: '# Old write' });
			assert.strictEqual(await section.saveSelectedSkillBody(), false);
			assert.strictEqual(requests.length, 2);
			await refreshDraft(section); assert.strictEqual(await section.saveSelectedSkillBody(), true);
			assert.deepStrictEqual(requests[2], { skillName: 'editable', content: '# Current draft', create: false, expectedSource: 'user', expectedContent: '# Old write' });
		});

		for (const transition of ['engine', 'link', 'dispose'] as const) {
			for (const outcome of ['accepted', 'refused', 'rejected'] as const) {
				test(`old toggle ${outcome} after ${transition} cannot refresh or repaint the current section`, async () => {
					const toggle = new DeferredPromise<{ ok: boolean }>();
					let lists = 0;
					const connection = createConnectionStub({
						connected: true, skillsSupport: 'SUPPORTED',
						listSkills: async () => { lists++; return { skills: [{ name: 'editable', source: 'user', enabled: true }] }; },
						getSkillInfo: async () => ({ name: 'editable', content: '# Current body', source: 'user', enabled: true }),
						setSkillEnabled: async () => toggle.p,
					});
					const section = mountSection(connection);
					await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
					const toggling = section.toggleSkillForTest('editable', false);
					if (transition === 'dispose') { section.dispose(); }
					else { connection.setPublishedLink(transition === 'engine' ? 'other-engine' : 'engine-test', 2); }
					await flushMicrotasks();
					const presentation = () => ({ lists, selected: section.getSelectedSkillName(), body: section.getSelectedSkillBody(), status: section.getDomNode().querySelector('.engine-skill-write-status')?.textContent, bodyStatus: section.getDomNode().querySelector('.engine-skill-body-status')?.textContent });
					const before = presentation();
					if (outcome === 'rejected') { await toggle.error(new Error('old request failed')); }
					else { await toggle.complete({ ok: outcome === 'accepted' }); }
					await toggling;
					assert.deepStrictEqual(presentation(), before);
				});
			}
		}

		for (const outcome of ['accepted', 'refused', 'rejected'] as const) {
			test(`toggle ${outcome} cannot repaint after its refresh crosses into another link`, async () => {
				const oldRefresh = new DeferredPromise<UniverseAgentListSkillsResult>();
				let lists = 0;
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async () => {
						lists++;
						return lists === 2 ? oldRefresh.p : { skills: [{ name: 'editable', source: 'user', enabled: true }] };
					},
					setSkillEnabled: async () => { if (outcome === 'rejected') { throw new Error('toggle failed'); } return { ok: outcome === 'accepted' }; },
				});
				const section = mountSection(connection); await flushMicrotasks();
				const toggling = section.toggleSkillForTest('editable', false); await flushMicrotasks();
				assert.strictEqual(lists, 2, 'the original toggle must have reached its refresh');
				connection.setPublishedLink('engine-test', 2); await flushMicrotasks();
				const status = section.getDomNode().querySelector('.engine-skill-write-status');
				const before = { lists, status: status?.textContent, display: (status as HTMLElement).style.display };
				await oldRefresh.complete({ skills: [{ name: 'obsolete', source: 'user', enabled: false }] });
				await toggling;
				assert.deepStrictEqual({ lists, status: status?.textContent, display: (status as HTMLElement).style.display }, before);
				assert.strictEqual(section.getListEntryCount(), 1);
			});
		}

		test('toggle requires a concrete published engine and link identity', async () => {
			let toggles = 0;
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED',
				setSkillEnabled: async () => { toggles++; return { ok: true }; },
			});
			const section = mountSection(connection); await flushMicrotasks();
			connection.setPublishedLink('', 0); await flushMicrotasks();
			await section.toggleSkillForTest('demo-skill', false);
			assert.strictEqual(toggles, 0);
		});
	});

	suite('expected owner IPC cancellation', () => {
		const ownerA: UniverseAgentExpectedOwner = { engineIdentityId: 'engine-test', linkId: 1 };
		const ownerA2: UniverseAgentExpectedOwner = { engineIdentityId: 'engine-test', linkId: 2 };
		const editable = { name: 'editable', source: 'user' as const, enabled: true };
		type SkillInfo = Awaited<ReturnType<IUniverseAgentConnection['getSkillInfo']>>;
		const cancellations = [
			{ name: 'raw', create: () => new CancellationError() },
			{
				name: 'IPC reconstructed',
				create: () => {
					const original = new CancellationError();
					const wire: { name: string; message: string; stack?: string[] } = JSON.parse(JSON.stringify({
						name: original.name, message: original.message, stack: original.stack?.split('\n'),
					}));
					// Match ChannelClient's PromiseError reconstruction, which loses the subclass.
					const error = new Error(wire.message);
					error.name = wire.name;
					error.stack = wire.stack?.join('\n');
					assert.strictEqual(error instanceof CancellationError, false);
					assert.strictEqual(isCancellationError(error), true);
					return error;
				},
			},
		];

		function editDraft(section: EngineSkillsSection, value: string): void {
			const input = leftoverBodyTextarea(section);
			input.value = value;
			input.dispatchEvent(new mainWindow.Event('input'));
		}

		async function withoutUnhandledRejections(action: () => Promise<void>): Promise<void> {
			const unhandled: unknown[] = [];
			const onBrowserRejection = (event: PromiseRejectionEvent) => { unhandled.push(event.reason); };
			const onNodeRejection = (reason: unknown) => { unhandled.push(reason); };
			mainWindow.addEventListener('unhandledrejection', onBrowserRejection);
			process.on('unhandledRejection', onNodeRejection);
			try {
				await action();
				await flushMicrotasks();
				assert.deepStrictEqual(unhandled, []);
			} finally {
				mainWindow.removeEventListener('unhandledrejection', onBrowserRejection);
				process.off('unhandledRejection', onNodeRejection);
			}
		}

		async function clickRefresh(section: EngineSkillsSection): Promise<void> {
			const refresh = section.getDomNode().querySelector<HTMLElement>('[aria-label="Refresh skills"]');
			assert.ok(refresh);
			refresh.click();
			await flushMicrotasks();
		}

		function presentation(section: EngineSkillsSection): object {
			const writeStatus = section.getDomNode().querySelector<HTMLElement>('.engine-skill-write-status');
			return {
				body: leftoverBodyTextarea(section).value,
				readOnly: leftoverBodyTextarea(section).readOnly,
				saveVisible: section.isSaveToolbarVisible(),
				canWrite: section.canWrite(),
				selected: section.getSelectedSkillName(),
				bodyStatus: leftoverBodyStatus(section).textContent,
				bodyStatusClass: leftoverBodyStatus(section).className,
				writeStatus: writeStatus?.textContent,
				writeStatusClass: writeStatus?.className,
			};
		}

		function assertCancelledDraft(section: EngineSkillsSection, draft: string): void {
			const status = leftoverBodyStatus(section);
			const writeStatus = section.getDomNode().querySelector<HTMLElement>('.engine-skill-write-status');
			assert.deepStrictEqual({
				body: leftoverBodyTextarea(section).value,
				readOnly: leftoverBodyTextarea(section).readOnly,
				bodyVisible: section.isBodyEditorVisible(),
				saveVisible: section.isSaveToolbarVisible(),
				canWrite: section.canWrite(),
				error: status.classList.contains('is-error'),
				success: writeStatus?.classList.contains('is-success'),
			}, { body: draft, readOnly: true, bodyVisible: true, saveVisible: false, canWrite: false, error: false, success: false });
			assert.ok(status.textContent?.includes('Refresh skills'));
			assert.ok(status.textContent?.includes('original engine'));
			assert.ok(!/Could not|Canceled|Created\.|Updated\.|Saved\./.test(`${status.textContent} ${writeStatus?.textContent}`));
			assertLeftoverSkillsRowTogglesClosed(section);
		}

		test('initial loading list and selected body receive an independent owner', async () => {
			const list = new DeferredPromise<UniverseAgentListSkillsResult>();
			const trace: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED',
				listSkills: owner => { trace.push({ method: 'list', owner }); return list.p; },
				getSkillInfo: async (_request, owner) => { trace.push({ method: 'info', owner }); return { ...editable, content: '# Original' }; },
			});
			const section = mountSection(connection);
			assert.deepStrictEqual({ mode: section.getMode(), canWrite: section.canWrite(), trace }, { mode: 'loading', canWrite: false, trace: [{ method: 'list', owner: ownerA }] });
			await list.complete({ skills: [editable] }); await flushMicrotasks();
			section.selectSkillForTest('editable'); await flushMicrotasks();
			assert.deepStrictEqual(trace, [{ method: 'list', owner: ownerA }, { method: 'info', owner: ownerA }]);
			assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
		});

		for (const missing of [{ identity: '', link: 1 }, { identity: 'engine-test', link: 0 }, { identity: 'engine-test', link: Number.MAX_SAFE_INTEGER + 1 }]) {
			test(`missing published owner ${missing.identity}/${missing.link} sends no Skills RPC or business failure`, async () => {
				let calls = 0;
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async () => { calls++; return { skills: [editable] }; },
					getSkillInfo: async () => { calls++; return { ...editable, content: '# Raw' }; },
					saveSkillContent: async () => { calls++; return { ok: true }; },
					setSkillEnabled: async () => { calls++; return { ok: true }; },
				});
				connection.setPublishedLinkQuiet(missing.identity, missing.link);
				const section = mountSection(connection); await flushMicrotasks();
				await section.createSkill({ skillName: 'new' });
				await section.saveSelectedSkillBody(); await section.toggleSkillForTest('editable', false);
				assert.deepStrictEqual({ calls, canWrite: section.canWrite(), writeVisible: section.isWriteToolbarVisible() }, { calls: 0, canWrite: false, writeVisible: false });
				assert.ok(!/Could not|is-error/.test(section.getDomNode().textContent ?? ''));
			});
		}

		test('Save and canonical preserve the original owner and raw CAS as independent arguments', async () => {
			let raw = '---\nname: editable\n---\n# Original';
			const trace: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
			const requests: UniverseAgentSaveSkillContentRequest[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED', listSkills: async () => ({ skills: [editable] }),
				getSkillInfo: async (_request, owner) => { trace.push({ method: 'info', owner }); return { ...editable, content: raw }; },
				saveSkillContent: async (request, owner) => { requests.push(request); trace.push({ method: 'save', owner }); raw = `---\nname: editable\n---\n${request.content}`; return { ok: true }; },
			});
			const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
			editDraft(section, '# First'); assert.strictEqual(await section.saveSelectedSkillBody(), true);
			editDraft(section, '# Second'); assert.strictEqual(await section.saveSelectedSkillBody(), true);
			assert.deepStrictEqual(trace, ['info', 'save', 'info', 'save', 'info'].map(method => ({ method, owner: ownerA })));
			assert.deepStrictEqual(requests, [
				{ skillName: 'editable', content: '# First', create: false, expectedSource: 'user', expectedContent: '---\nname: editable\n---\n# Original' },
				{ skillName: 'editable', content: '# Second', create: false, expectedSource: 'user', expectedContent: '---\nname: editable\n---\n# First' },
			]);
		});

		test('New dialog, creation, refresh and selection all forward its original owner', async () => {
			const dialogGate = new DeferredPromise<Awaited<ReturnType<IDialogService['input']>>>();
			const dialog = new TestDialogService(); dialog.input = () => dialogGate.p;
			let created = false;
			const trace: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED',
				listSkills: async owner => { trace.push({ method: 'list', owner }); return { skills: created ? [editable] : [] }; },
				saveSkillContent: async (request, owner) => { assert.strictEqual(request.create, true); assert.strictEqual(Object.hasOwn(request, 'owner'), false); trace.push({ method: 'create', owner }); created = true; return { ok: true }; },
				getSkillInfo: async (_request, owner) => { trace.push({ method: 'info', owner }); return { ...editable, content: '# Created' }; },
			});
			const section = mountSection(connection, dialog); await flushMicrotasks();
			(section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement).click();
			await dialogGate.complete({ confirmed: true, values: ['editable'] }); await flushMicrotasks();
			assert.deepStrictEqual(trace.slice(0, 3), ['list', 'create', 'list'].map(method => ({ method, owner: ownerA })));
			assert.ok(trace.length > 3 && trace.slice(3).every(call => call.method === 'info'));
			assert.deepStrictEqual(trace.map(call => call.owner), trace.map(() => ownerA));
		});

		for (const accepted of [true, false]) {
			test(`toggle ${accepted ? 'success' : 'ordinary refusal'} refresh and implicit selected read keep the action owner`, async () => {
				const trace: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async owner => { trace.push({ method: 'list', owner }); return { skills: [editable] }; },
					getSkillInfo: async (_request, owner) => { trace.push({ method: 'info', owner }); return { ...editable, content: '# Raw' }; },
					setSkillEnabled: async (request, owner) => { assert.deepStrictEqual(request, { skillName: 'editable', enabled: false }); trace.push({ method: 'toggle', owner }); return { ok: accepted }; },
				});
				const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
				await section.toggleSkillForTest('editable', false); await flushMicrotasks();
				assert.deepStrictEqual(trace.slice(0, 4), ['list', 'info', 'toggle', 'list'].map(method => ({ method, owner: ownerA })));
				assert.ok(trace.length > 4 && trace.slice(4).every(call => call.method === 'info'));
				assert.deepStrictEqual(trace.map(call => call.owner), trace.map(() => ownerA));
			});
		}

		test('selection from an older catalog cannot capture a newer snapshot owner for its body read', async () => {
			const owners: (UniverseAgentExpectedOwner | undefined)[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED', listSkills: async () => ({ skills: [editable] }),
				getSkillInfo: async (_request, owner) => { owners.push(owner); return { ...editable, content: '# A raw' }; },
			});
			const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
			connection.setPublishedLinkQuiet('other-engine', 2);
			section.selectSkillForTest('editable'); await flushMicrotasks();
			assert.deepStrictEqual(owners, [ownerA]);
			assertLeftoverBodyEditorClosed(section);
			assert.strictEqual(await section.saveSelectedSkillBody(), false);
		});

		for (const transition of ['engine', 'link'] as const) {
			test(`an old catalog after a quiet ${transition} change cannot write and a fully applied new catalog restores actions`, () => withoutUnhandledRejections(async () => {
				const nextList = new DeferredPromise<UniverseAgentListSkillsResult>();
				const nextOwner: UniverseAgentExpectedOwner = { engineIdentityId: transition === 'engine' ? 'other-engine' : 'engine-test', linkId: 2 };
				const writes: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
				const requests: UniverseAgentSaveSkillContentRequest[] = [];
				let lists = 0;
				let dialogs = 0;
				let raw = '# A raw';
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async () => ++lists === 1 ? { skills: [editable] } : nextList.p,
					getSkillInfo: async () => ({ ...editable, content: raw }),
					saveSkillContent: async (request, owner) => { writes.push({ method: 'save', owner }); requests.push(request); raw = request.content; return { ok: true }; },
					setSkillEnabled: async (_request, owner) => { writes.push({ method: 'toggle', owner }); return { ok: true }; },
				});
				const dialog = new TestDialogService(); dialog.input = async () => { dialogs++; return { confirmed: true, values: ['created'] }; };
				const section = mountSection(connection, dialog);
				section.setSectionActive(true);
				await flushMicrotasks();
				section.layout(640, 160);
				section.selectSkillForTest('editable'); await flushMicrotasks();
				assertLeftoverSkillsRowTogglesLive(section);
				connection.setPublishedLinkQuiet(nextOwner.engineIdentityId, nextOwner.linkId);
				assert.strictEqual(section.canWrite(), false, 'an old ready mode cannot authorize the next owner');
				leftoverSkillsRowToggles(section)[0].click();
				(section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement).click();
				assert.strictEqual(await section.toggleSkillForTest('editable', false), undefined);
				assert.strictEqual(await section.createSkill({ skillName: 'old-intent' }), false);
				assert.strictEqual(await section.saveSelectedSkillBody('# Old body intent'), false);
				await flushMicrotasks();
				assert.deepStrictEqual({ writes, dialogs, lists }, { writes: [], dialogs: 0, lists: 1 });
				raw = '# Current raw';
				connection.setPublishedLink(nextOwner.engineIdentityId, nextOwner.linkId); await flushMicrotasks();
				assert.strictEqual(section.canWrite(), false);
				await section.toggleSkillForTest('editable', false);
				assert.deepStrictEqual(writes, [], 'a pending next catalog still cannot authorize old rows');
				await nextList.complete({ skills: [editable] }); await flushMicrotasks();
				assert.strictEqual(section.canWrite(), true);
				assertLeftoverSkillsRowTogglesLive(section);
				editDraft(section, '# Current body');
				assert.strictEqual(await section.saveSelectedSkillBody(), true);
				assert.deepStrictEqual(requests[0], { skillName: 'editable', content: '# Current body', create: false, expectedSource: 'user', expectedContent: '# Current raw' });
				await section.toggleSkillForTest('editable', false); await flushMicrotasks();
				assert.strictEqual(await section.createSkill({ skillName: 'current-intent' }), true);
				assert.deepStrictEqual(writes, ['save', 'toggle', 'save'].map(method => ({ method, owner: nextOwner })));
			}));
		}

		for (const reentry of ['quiet snapshot', 'nested refresh'] as const) {
			test(`catalog count notification ${reentry} cannot publish a stale owner or reopen its write chrome`, () => withoutUnhandledRejections(async () => {
				const latestList = new DeferredPromise<UniverseAgentListSkillsResult>();
				const extra = { name: 'new-only', source: 'user' as const, enabled: true };
				const latestOwner: UniverseAgentExpectedOwner = { engineIdentityId: 'latest-engine', linkId: 3 };
				const writes: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
				const attempts: Promise<boolean | void>[] = [];
				let armed = false;
				let reentered = false;
				let observed: { canWrite: boolean; rows: number } | undefined;
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async owner => owner?.linkId === 3 ? latestList.p : { skills: owner?.linkId === 2 ? [editable, extra] : [editable] },
					getSkillInfo: async () => ({ ...editable, content: '# Latest raw' }),
					saveSkillContent: async (_request, owner) => { writes.push({ method: 'save', owner }); return { ok: true }; },
					setSkillEnabled: async (_request, owner) => { writes.push({ method: 'toggle', owner }); return { ok: true }; },
				});
				const section = mountSection(connection);
				section.setSectionActive(true);
				await flushMicrotasks();
				section.layout(640, 160);
				section.selectSkillForTest('editable'); await flushMicrotasks();
				assertLeftoverSkillsRowTogglesLive(section);
				store.add(section.onDidChangeItemCount(() => {
					if (!armed || reentered || section.getItemCount() !== 2) { return; }
					reentered = true;
					observed = { canWrite: section.canWrite(), rows: section.getListEntryCount() };
					const toggles = leftoverSkillsRowToggles(section);
					assert.strictEqual(toggles.length, 2, 'both catalog rows must paint toggle chrome before reentrant clicks');
					for (const toggle of toggles) { toggle.click(); }
					attempts.push(section.toggleSkillForTest('editable', false), section.toggleSkillForTest('new-only', false), section.createSkill({ skillName: 'during-count' }), section.saveSelectedSkillBody('# During count'));
					if (reentry === 'quiet snapshot') { connection.setPublishedLinkQuiet(latestOwner.engineIdentityId, latestOwner.linkId); }
					else { connection.setPublishedLink(latestOwner.engineIdentityId, latestOwner.linkId); }
				}));
				armed = true;
				connection.setPublishedLink('middle-engine', 2); await flushMicrotasks();
				assert.deepStrictEqual(observed, { canWrite: false, rows: 2 });
				assert.deepStrictEqual(await Promise.all(attempts), [undefined, undefined, false, false]);
				assert.deepStrictEqual({ writes, canWrite: section.canWrite(), toolbar: section.isWriteToolbarVisible(), mode: section.getMode() }, { writes: [], canWrite: false, toolbar: false, mode: 'loading' });
				if (reentry === 'quiet snapshot') { connection.setPublishedLink(latestOwner.engineIdentityId, latestOwner.linkId); await flushMicrotasks(); }
				await latestList.complete({ skills: [editable] }); await flushMicrotasks();
				assert.strictEqual(section.canWrite(), true);
				assertLeftoverSkillsRowTogglesLive(section);
				await section.toggleSkillForTest('editable', false); await flushMicrotasks();
				assert.strictEqual(await section.createSkill({ skillName: 'after-count' }), true);
				assert.deepStrictEqual(writes, ['toggle', 'save'].map(method => ({ method, owner: latestOwner })));
			}));
		}

		test('a locally changed owner cannot be recaptured for a successful write follow-up', async () => {
			const owners: (UniverseAgentExpectedOwner | undefined)[] = [];
			const connection = createConnectionStub({
				connected: true, skillsSupport: 'SUPPORTED', listSkills: async owner => { owners.push(owner); return { skills: [] }; },
				saveSkillContent: async (_request, owner) => { owners.push(owner); connection.setPublishedLinkQuiet('other-engine', 2); return { ok: true }; },
			});
			const section = mountSection(connection); await flushMicrotasks();
			assert.strictEqual(await section.createSkill({ skillName: 'created' }), false);
			assert.deepStrictEqual(owners, [ownerA, ownerA]);
		});

		const currentCases = [
			{ action: 'create', draft: '# Draft', payload: '# Draft' },
			{ action: 'save', draft: '# Draft', payload: '# Draft' },
			{ action: 'save', draft: '', payload: '' },
			{ action: 'save', draft: '# Original', payload: '# Sent' },
			{ action: 'canonical', draft: '# Newer draft', payload: '# Sent' },
			{ action: 'toggle', draft: '# Draft', payload: '# Draft' },
			{ action: 'list', draft: '', payload: '' },
			{ action: 'info', draft: '# Typed during reload', payload: '# Original' },
		] as const;
		for (const cancellation of cancellations) {
			for (const current of currentCases) {
				test(`${cancellation.name} current ${current.action} cancellation keeps ${JSON.stringify(current.draft)} while the renderer still caches A`, () => withoutUnhandledRejections(async () => {
					const writeGate = new DeferredPromise<{ ok: boolean }>();
					const listGate = new DeferredPromise<UniverseAgentListSkillsResult>();
					const infoGate = new DeferredPromise<SkillInfo>();
					let blocked = false;
					let raw = '# Original';
					const calls = { lists: 0, infos: 0, saves: 0, toggles: 0 };
					const owners: (UniverseAgentExpectedOwner | undefined)[] = [];
					const requests: UniverseAgentSaveSkillContentRequest[] = [];
					const connection = createConnectionStub({
						connected: true, skillsSupport: 'SUPPORTED',
						listSkills: async owner => { calls.lists++; owners.push(owner); return blocked && current.action === 'list' ? listGate.p : { skills: [editable] }; },
						getSkillInfo: async (_request, owner) => { calls.infos++; owners.push(owner); return blocked && (current.action === 'canonical' || current.action === 'info') ? infoGate.p : { ...editable, content: raw }; },
						saveSkillContent: async (request, owner) => { calls.saves++; owners.push(owner); requests.push(request); if (blocked && (current.action === 'create' || current.action === 'save')) { return writeGate.p; } raw = request.content; return { ok: true }; },
						setSkillEnabled: async (_request, owner) => { calls.toggles++; owners.push(owner); return writeGate.p; },
					});
					const dialog = new TestDialogService(); dialog.input = async () => ({ confirmed: true, values: ['created'] });
					const section = mountSection(connection, dialog); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
					if (current.action !== 'info') { editDraft(section, current.payload); }
					blocked = true;
					let pending: Promise<boolean | void> | undefined;
					if (current.action === 'create') { (section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement).click(); }
					else if (current.action === 'save' || current.action === 'canonical') { pending = section.saveSelectedSkillBody(); }
					else if (current.action === 'toggle') { pending = section.toggleSkillForTest('editable', false); }
					else { await clickRefresh(section); }
					await flushMicrotasks();
					if (current.draft !== current.payload) { editDraft(section, current.draft); }
					const before = { ...calls };
					if (current.action === 'list') { await listGate.error(cancellation.create()); }
					else if (current.action === 'canonical' || current.action === 'info') { await infoGate.error(cancellation.create()); }
					else { await writeGate.error(cancellation.create()); }
					if (pending) { assert.strictEqual(await pending, current.action === 'toggle' ? undefined : false); }
					await flushMicrotasks();
					assert.deepStrictEqual(connection.getConnectionSnapshot().engineIdentityId, ownerA.engineIdentityId);
					assertCancelledDraft(section, current.draft);
					assert.deepStrictEqual(calls, before, 'owner cancellation must not automatically refresh or read back');
					assert.strictEqual(await section.saveSelectedSkillBody(), false);
					await clickRefresh(section);
					assert.deepStrictEqual(calls, before, 'a cached rejected owner cannot be immediately reauthorized');
					assert.deepStrictEqual(owners, owners.map(() => ownerA));
					blocked = false; raw = '# Recovered raw';
					const beforeRecoveryOwners = owners.length;
					connection.setPublishedLink('engine-test', 2); await flushMicrotasks();
					assert.strictEqual(leftoverBodyTextarea(section).readOnly, true, 'notification alone cannot restore CAS');
					const beforeRecoveryReads = calls.infos;
					await clickRefresh(section);
					assert.ok(calls.infos > beforeRecoveryReads);
					assert.deepStrictEqual({ body: leftoverBodyTextarea(section).value, readOnly: leftoverBodyTextarea(section).readOnly }, { body: current.draft, readOnly: false });
					assert.strictEqual(await section.saveSelectedSkillBody(), true);
					assert.deepStrictEqual(requests.at(-1), { skillName: 'editable', content: current.draft, create: false, expectedSource: 'user', expectedContent: '# Recovered raw' });
					assert.deepStrictEqual(owners.slice(beforeRecoveryOwners), owners.slice(beforeRecoveryOwners).map(() => ownerA2));
				}));
			}

			test(`${cancellation.name} initial info cancellation never authorizes a body or paints a business error`, () => withoutUnhandledRejections(async () => {
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED', listSkills: async () => ({ skills: [editable] }),
					getSkillInfo: async () => { throw cancellation.create(); },
				});
				const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
				assertLeftoverBodyEditorClosed(section);
				assert.strictEqual(section.canWrite(), false);
				assert.ok(!/Could not|Canceled/.test(section.getDomNode().textContent ?? ''));
				assert.ok(section.getDomNode().textContent?.includes('original engine'));
			}));

			for (const phase of ['save', 'canonical'] as const) {
				test(`${cancellation.name} old ${phase} cancellation cannot suspend a recovered draft or release a newer save token`, async () => {
					const oldWrite = new DeferredPromise<{ ok: boolean }>();
					const oldRead = new DeferredPromise<SkillInfo>();
					const newWrite = new DeferredPromise<{ ok: boolean }>();
					const requests: { request: UniverseAgentSaveSkillContentRequest; owner: UniverseAgentExpectedOwner | undefined }[] = [];
					let raw = '# Original';
					let infos = 0;
					const connection = createConnectionStub({
						connected: true, skillsSupport: 'SUPPORTED', listSkills: async () => ({ skills: [editable] }),
						getSkillInfo: async () => { infos++; return phase === 'canonical' && infos === 2 ? oldRead.p : { ...editable, content: raw }; },
						saveSkillContent: async (request, owner) => { requests.push({ request, owner }); return requests.length === 1 ? phase === 'save' ? oldWrite.p : { ok: true } : requests.length === 2 ? newWrite.p : { ok: false }; },
					});
					const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
					editDraft(section, '# First'); const first = section.saveSelectedSkillBody(); await flushMicrotasks();
					connection.setConnected(false); connection.setPublishedLink('engine-test', 2); connection.setConnected(true); await flushMicrotasks();
					raw = '# Recovered raw'; await clickRefresh(section);
					editDraft(section, '# Second'); const second = section.saveSelectedSkillBody();
					assert.strictEqual(requests.length, 2);
					const before = presentation(section);
					if (phase === 'save') { await oldWrite.error(cancellation.create()); }
					else { await oldRead.error(cancellation.create()); }
					assert.strictEqual(await first, false);
					assert.deepStrictEqual(presentation(section), before);
					assert.strictEqual(await section.saveSelectedSkillBody(), false, 'old cancellation/finally cannot release the new lock');
					assert.strictEqual(requests.length, 2);
					raw = '# New canonical'; await newWrite.complete({ ok: true });
					assert.strictEqual(await second, true);
					editDraft(section, '# Third'); assert.strictEqual(await section.saveSelectedSkillBody(), false);
					assert.deepStrictEqual(requests[2], { request: { skillName: 'editable', content: '# Third', create: false, expectedSource: 'user', expectedContent: '# New canonical' }, owner: ownerA2 });
				});
			}

			test(`${cancellation.name} old list cancellation cannot close a newer recovered editor`, () => withoutUnhandledRejections(async () => {
				const oldList = new DeferredPromise<UniverseAgentListSkillsResult>();
				let lists = 0;
				let infos = 0;
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED',
					listSkills: async () => { lists++; return lists === 2 ? oldList.p : { skills: [editable] }; },
					getSkillInfo: async () => { infos++; return { ...editable, content: '# Raw' }; },
				});
				const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
				editDraft(section, '# Draft'); await clickRefresh(section);
				connection.setPublishedLink('engine-test', 2); await flushMicrotasks(); await clickRefresh(section);
				const before = { state: presentation(section), lists, infos };
				await oldList.error(cancellation.create()); await flushMicrotasks();
				assert.deepStrictEqual({ state: presentation(section), lists, infos }, before);
				assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
			}));

			test(`${cancellation.name} old selected info cannot suspend a newer skill under the same owner`, () => withoutUnhandledRejections(async () => {
				const oldRead = new DeferredPromise<SkillInfo>();
				const other = { name: 'other', source: 'user' as const, enabled: true };
				const requests: UniverseAgentSaveSkillContentRequest[] = [];
				const connection = createConnectionStub({
					connected: true, skillsSupport: 'SUPPORTED', listSkills: async () => ({ skills: [editable, other] }),
					getSkillInfo: async request => request.skillName === 'editable' ? oldRead.p : { ...other, content: '# Other raw' },
					saveSkillContent: async request => { requests.push(request); return { ok: false }; },
				});
				const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
				section.selectSkillForTest('other'); await flushMicrotasks(); editDraft(section, '# Other draft');
				const before = presentation(section);
				await oldRead.error(cancellation.create()); await flushMicrotasks();
				assert.deepStrictEqual(presentation(section), before);
				assert.strictEqual(await section.saveSelectedSkillBody(), false);
				assert.deepStrictEqual(requests, [{ skillName: 'other', content: '# Other draft', create: false, expectedSource: 'user', expectedContent: '# Other raw' }]);
			}));

			for (const action of ['create', 'toggle'] as const) {
				test(`${cancellation.name} ${action} success followed by a late info cancellation revokes its success notice`, () => withoutUnhandledRejections(async () => {
					const infoGate = new DeferredPromise<SkillInfo>();
					let infos = 0;
					let lists = 0;
					const connection = createConnectionStub({
						connected: true, skillsSupport: 'SUPPORTED',
						listSkills: async () => { lists++; return { skills: [editable] }; },
						getSkillInfo: async () => { infos++; return infos === 1 ? { ...editable, content: '# Original' } : infoGate.p; },
					});
					const section = mountSection(connection); await flushMicrotasks(); section.selectSkillForTest('editable'); await flushMicrotasks();
					if (action === 'create') { assert.strictEqual(await section.createSkill({ skillName: 'editable' }), true); }
					else { assert.strictEqual(await section.toggleSkillForTest('editable', false), undefined); }
					await flushMicrotasks();
					assert.ok(infos >= 2);
					const before = { lists, infos };
					editDraft(section, '# Typed after write');
					await infoGate.error(cancellation.create()); await flushMicrotasks();
					assertCancelledDraft(section, '# Typed after write');
					assert.deepStrictEqual({ lists, infos }, before);
				}));
			}
		}
	});

	test('Skills: dirty body selection to another skill keeps A and does not save B', async () => {
		const savedNames: string[] = [];
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'skill-a', source: 'user', enabled: true },
					{ name: 'skill-b', source: 'user', enabled: true },
				],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: request.skillName === 'skill-a' ? '# Body of A' : '# Body of B',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async (request) => {
				savedNames.push(request.skillName);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'skill-a');
		assert.ok(section.getSelectedSkillBody().includes('# Body of A'));
		assert.strictEqual(section.isSkillBodyDirty(), false);
		const savesAfterLoadA = savedNames.length;

		const dirtyA = `${section.getSelectedSkillBody()}\n# dirty A`;
		section.setSelectedSkillBody(dirtyA);
		assert.strictEqual(section.isSkillBodyDirty(), true);

		section.selectSkillForTest('skill-b');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillName(), 'skill-a');
		assert.strictEqual(section.getSelectedSkillBody(), dirtyA);
		assert.strictEqual(section.isSkillBodyDirty(), true);

		const ok = await section.saveSelectedSkillBody();
		assert.strictEqual(ok, true);
		assert.ok(savedNames.length > savesAfterLoadA);
		assert.strictEqual(savedNames[savedNames.length - 1], 'skill-a');
		assert.ok(savedNames.every(name => name === 'skill-a'));
	});

	test('Skills: dirty body selection of a group header keeps the skill and the text', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'skill-a', source: 'user', enabled: true },
					{ name: 'skill-b', source: 'user', enabled: true },
				],
			}),
			getSkillInfo: async (request) => {
				infoCalls++;
				return {
					name: request.skillName,
					content: request.skillName === 'skill-a' ? '# Body of A' : '# Body of B',
					source: 'user',
					enabled: true,
				};
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();
		const dirtyA = `${section.getSelectedSkillBody()}\n# dirty A`;
		section.setSelectedSkillBody(dirtyA);
		const infoAfterLoad = infoCalls;

		section.selectSkillGroupForTest('user');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillName(), 'skill-a');
		assert.strictEqual(section.getSelectedSkillBody(), dirtyA);
		assert.strictEqual(section.isSkillBodyDirty(), true);
		assert.strictEqual(infoCalls, infoAfterLoad);
	});

	test('Skills: clean body selection of a group header clears the editor', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'skill-a', source: 'user', enabled: true }],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Body of A',
				source: 'user',
				enabled: true,
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();
		assert.strictEqual(section.isSkillBodyDirty(), false);

		section.selectSkillGroupForTest('user');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillName(), undefined);
		assert.strictEqual(section.getSelectedSkillBody(), '');
		assert.strictEqual(section.isSkillBodyDirty(), false);
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		assert.ok(bodyStatus.textContent?.includes('Select a skill to read its content.'));
	});

	test('Skills: dirty body reselecting the same skill is not blocked', async () => {
		const savedNames: string[] = [];
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'skill-a', source: 'user', enabled: true },
					{ name: 'skill-b', source: 'user', enabled: true },
				],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: request.skillName === 'skill-a' ? '# Body of A' : '# Body of B',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async (request) => {
				savedNames.push(request.skillName);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();
		const dirtyA = `${section.getSelectedSkillBody()}\n# dirty A`;
		section.setSelectedSkillBody(dirtyA);
		assert.strictEqual(section.isSkillBodyDirty(), true);
		const savesAfterDirty = savedNames.length;

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillName(), 'skill-a');
		assert.strictEqual(section.getSelectedSkillBody(), dirtyA);
		assert.strictEqual(section.isSkillBodyDirty(), true);
		assert.strictEqual(savedNames.length, savesAfterDirty);
	});

	test('Skills: clean body selection to another skill still changes selectedSkill', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'skill-a', source: 'user', enabled: true },
					{ name: 'skill-b', source: 'user', enabled: true },
				],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: request.skillName === 'skill-a' ? '# Body of A' : '# Body of B',
				source: 'user',
				enabled: true,
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'skill-a');
		assert.strictEqual(section.isSkillBodyDirty(), false);

		section.selectSkillForTest('skill-b');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillName(), 'skill-b');
		assert.ok(section.getSelectedSkillBody().includes('# Body of B'));
	});

	test('Skills: switching skills clears the previous body and does not save it onto the next skill', async () => {
		const saved: UniverseAgentSaveSkillContentRequest[] = [];
		let releaseB: (() => void) | undefined;
		let bStarted: (() => void) | undefined;
		const bEntered = new Promise<void>(resolve => { bStarted = resolve; });
		const bHold = new Promise<void>(resolve => { releaseB = resolve; });
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'skill-a', source: 'user', enabled: true },
					{ name: 'skill-b', source: 'user', enabled: true },
				],
			}),
			getSkillInfo: async (request) => {
				if (request.skillName === 'skill-b') {
					bStarted?.();
					await bHold;
					return { name: 'skill-b', content: '# Body of B', source: 'user', enabled: true };
				}
				return { name: request.skillName, content: '# Body of A', source: 'user', enabled: true };
			},
			saveSkillContent: async (request) => {
				saved.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('skill-a');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), '# Body of A');
		assert.strictEqual(section.isSaveToolbarVisible(), true);

		section.selectSkillForTest('skill-b');
		await bEntered;

		assert.strictEqual(section.getSelectedSkillName(), 'skill-b');
		assert.strictEqual(section.getSelectedSkillBody(), '');
		assert.strictEqual(leftoverBodyTextarea(section).value, '');
		assert.strictEqual(leftoverBodyTextarea(section).readOnly, true);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
		assert.ok(leftoverBodyStatus(section).textContent?.includes(getCatalogListLoadingCopy()));
		assert.strictEqual(await section.saveSelectedSkillBody(), false);
		assert.strictEqual(await section.saveSelectedSkillBody('# Body of A'), false);
		assert.deepStrictEqual(saved, []);

		releaseB!();
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillName(), 'skill-b');
		assert.strictEqual(section.getSelectedSkillBody(), '# Body of B');
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
	});

	test('bundled skill body is read-only and does not show save toolbar', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			getSkillInfo: async () => ({
				name: 'demo-skill',
				content: '# Bundled',
				source: 'bundled',
				enabled: true,
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();

		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement;
		assert.ok(textarea.readOnly);
		assert.strictEqual(section.isSaveToolbarVisible(), false);

		const ok = await section.saveSelectedSkillBody('# hack');
		assert.strictEqual(ok, false);
	});

	test('successful refresh then getSkillInfo throw keeps leftover body and paints load-failed', async () => {
		let getSkillInfoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			}),
			getSkillInfo: async (request) => {
				getSkillInfoCalls++;
				if (getSkillInfoCalls === 1) {
					return {
						name: request.skillName,
						content: '# Stale skill body',
						source: 'bundled',
						enabled: true,
					};
				}
				throw new Error('getSkillInfo exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.ok(section.getSelectedSkillBody().includes('# Stale skill body'));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.ok(bodyStatus.textContent?.includes(localize(
			'ua.engineSkillBodyLoadFailed',
			"Could not load skill content from the engine.",
		)));
		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement | null;
		assert.ok(textarea);
		assert.ok(textarea.value.includes('# Stale skill body'));
		assert.ok(section.getSelectedSkillBody().includes('# Stale skill body'));
		assert.ok((section.getDomNode().textContent ?? '').includes('# Stale skill body'));
	});

	test('successful body then list throw then select leftover keeps body text', async () => {
		let listSkillsCalls = 0;
		let infoCalls = 0;
		const leftoverBody = '# Leftover skill body';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: leftoverBody, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, 2);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
	});

	test('successful body then capability UNKNOWN then select leftover keeps body text', async () => {
		let listSkillsCalls = 0;
		let infoCalls = 0;
		const leftoverBody = '# Leftover skill body';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: leftoverBody, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
		const listCallsAfterLoad = listSkillsCalls;

		connection.setSkillsSupport('UNKNOWN');
		await flushMicrotasks();

		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
	});

	test('leftover body stays after pairing re-select, then true disconnect clears', async () => {
		let listSkillsCalls = 0;
		let infoCalls = 0;
		const leftoverBody = '# Leftover skill body';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: leftoverBody, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assertSkillsLeftoverPairingHonesty(section, leftoverRows);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assertSkillsLeftoverPairingHonesty(section, leftoverRows);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
		assert.ok((section.getDomNode().textContent ?? '').includes(getEngineSectionDisconnectedCopy()));

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getSelectedSkillBody(), '');
	});

	test('leftover-looks-live pairing-hold loadSkillBody skips extra getSkillInfo', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		const infoCallsAfterLoad = infoCalls;
		assert.ok(infoCallsAfterLoad >= 1);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		connection.setLooksLive(true);
		connection.setPairingPendingQuiet(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'leftover-looks-live must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assert.ok((section.getDomNode().textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(INFLIGHT_LIVE_SKILL_BODY));
	});

	test('pairing-hold refresh paints leftover body honesty without reselect', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(!(leftoverBodyStatus(section).textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		const infoCallsAfterLoad = infoCalls;

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'KEEP must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assertLeftoverBodyEditorClosed(section);
		const bodyStatus = leftoverBodyStatus(section);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(getEngineSectionDisconnectedCopy()));
	});

	test('leftover-looks-live refresh paints leftover body honesty without reselect', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(!(leftoverBodyStatus(section).textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		const infoCallsAfterLoad = infoCalls;

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'KEEP must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assertLeftoverBodyEditorClosed(section);
		const bodyStatus = leftoverBodyStatus(section);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(getEngineSectionDisconnectedCopy()));
	});

	test('pairing-hold refresh closes leftover user body Save chrome without reselect', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
		assert.ok(!(leftoverBodyStatus(section).textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		const infoCallsAfterLoad = infoCalls;

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'KEEP must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assertLeftoverBodyEditorClosed(section);
		const bodyStatus = leftoverBodyStatus(section);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(getEngineSectionDisconnectedCopy()));
	});

	test('leftover-looks-live refresh closes leftover user body Save chrome without reselect', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
		assert.ok(!(leftoverBodyStatus(section).textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		const infoCallsAfterLoad = infoCalls;

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'KEEP must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assertLeftoverBodyEditorClosed(section);
		const bodyStatus = leftoverBodyStatus(section);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(getEngineSectionDisconnectedCopy()));
	});

	test('capability UNKNOWN leftover closes leftover user body Save chrome without reselect', async () => {
		let saveCalls = 0;
		let infoCalls = 0;
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] };
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true };
			},
			saveSkillContent: async () => {
				saveCalls++;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;
		const infoCallsAfterLoad = infoCalls;

		connection.setSkillsSupport('UNKNOWN');
		await flushMicrotasks();

		assertSkillsLeftoverUnknownHonesty(section, leftoverRows);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad, 'UNKNOWN leftover must not extra listSkills');
		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'UNKNOWN leftover must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assertLeftoverBodyEditorClosed(section);
		const ok = await section.saveSelectedSkillBody('# should not save');
		assert.strictEqual(ok, false);
		assert.strictEqual(saveCalls, 0);
	});

	test('list-fail leftover closes leftover user body Save chrome without reselect', async () => {
		let saveCalls = 0;
		let infoCalls = 0;
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true };
			},
			saveSkillContent: async () => {
				saveCalls++;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assert.strictEqual(leftoverBodyTextarea(section).readOnly, false);
		const leftoverRows = section.getListEntryCount();
		const infoCallsAfterLoad = infoCalls;

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, 2);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', leftoverRows);
		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'list-fail leftover must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assertLeftoverBodyEditorClosed(section);
		const ok = await section.saveSelectedSkillBody('# should not save');
		assert.strictEqual(ok, false);
		assert.strictEqual(saveCalls, 0);
	});

	test('pairing-hold refresh closes leftover row toggle chrome without reselect', async () => {
		const toggleCalls: Array<{ skillName: string; enabled: boolean }> = [];
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => ({ name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true }),
			setSkillEnabled: async (request) => {
				toggleCalls.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		section.layout(640, 160);

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.canWrite(), true);
		assertLeftoverSkillsRowTogglesLive(section);
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.canWrite(), false);
		assertLeftoverSkillsRowTogglesClosed(section);
		await section.toggleSkillForTest('leftover-skill', false);
		assert.deepStrictEqual(toggleCalls, []);
	});

	test('leftover-looks-live refresh closes leftover row toggle chrome without reselect', async () => {
		const toggleCalls: Array<{ skillName: string; enabled: boolean }> = [];
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] }),
			getSkillInfo: async () => ({ name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true }),
			setSkillEnabled: async (request) => {
				toggleCalls.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		section.layout(640, 160);

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.canWrite(), true);
		assertLeftoverSkillsRowTogglesLive(section);
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.canWrite(), false);
		assertLeftoverSkillsRowTogglesClosed(section);
		await section.toggleSkillForTest('leftover-skill', false);
		assert.deepStrictEqual(toggleCalls, []);
	});

	test('capability UNKNOWN leftover closes leftover row toggle chrome without reselect', async () => {
		const toggleCalls: Array<{ skillName: string; enabled: boolean }> = [];
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] };
			},
			getSkillInfo: async () => ({ name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true }),
			setSkillEnabled: async (request) => {
				toggleCalls.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		section.layout(640, 160);

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.canWrite(), true);
		assertLeftoverSkillsRowTogglesLive(section);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;

		connection.setSkillsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, listCallsAfterLoad, 'UNKNOWN leftover must not extra listSkills');
		assertSkillsLeftoverUnknownHonesty(section, leftoverRows);
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.canWrite(), false);
		assertLeftoverSkillsRowTogglesClosed(section);
		await section.toggleSkillForTest('leftover-skill', false);
		assert.deepStrictEqual(toggleCalls, []);
	});

	test('list-fail leftover closes leftover row toggle chrome without reselect', async () => {
		const toggleCalls: Array<{ skillName: string; enabled: boolean }> = [];
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
			getSkillInfo: async () => ({ name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'user', enabled: true }),
			setSkillEnabled: async (request) => {
				toggleCalls.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		section.layout(640, 160);

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.canWrite(), true);
		assertLeftoverSkillsRowTogglesLive(section);
		const leftoverRows = section.getListEntryCount();

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, 2);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', leftoverRows);
		assert.strictEqual(section.getSelectedSkillName(), 'leftover-skill');
		assert.strictEqual(section.canWrite(), false);
		assertLeftoverSkillsRowTogglesClosed(section);
		await section.toggleSkillForTest('leftover-skill', false);
		assert.deepStrictEqual(toggleCalls, []);
	});

	test('in-flight getSkillInfo leftover-looks-live keeps leftover and does not paint live', async () => {
		let infoCalls = 0;
		let releaseSecond: (() => void) | undefined;
		let secondStarted: (() => void) | undefined;
		const secondEntered = new Promise<void>(resolve => { secondStarted = resolve; });
		const secondHold = new Promise<void>(resolve => { releaseSecond = resolve; });
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				if (infoCalls === 1) {
					return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'bundled', enabled: true };
				}
				secondStarted?.();
				await secondHold;
				return { name: 'leftover-skill', content: INFLIGHT_LIVE_SKILL_BODY, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.strictEqual(isConversationPairingHold(connection), false);

		section.selectSkillForTest('leftover-skill');
		await secondEntered;
		assert.strictEqual(infoCalls, 2);

		connection.setLooksLive(true);
		connection.setPairingPendingQuiet(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		releaseSecond!();
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(INFLIGHT_LIVE_SKILL_BODY), 'in-flight leftover-looks-live must not paint live');
		assert.ok((section.getDomNode().textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.ok(section.isBodyEditorVisible());
	});

	test('disconnected saveSelectedSkillBody does not call saveSkillContent RPC', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			skillsSupport: 'SUPPORTED',
			saveSkillContent: async () => {
				saveCalled = true;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		const ok = await section.saveSelectedSkillBody('# should not save');
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
		assert.strictEqual(section.canWrite(), false);
	});

	test('does not leak unhandled rejection when refresh catch-path render throws and onUnexpectedError warn-then-rethrows', async () => {
		// refresh() already catches listSkills; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path render throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					throw new Error('listSkills exploded');
				},
			});
			const section = mountSection(connection);
			const status = (section as unknown as { status: { render(options: { readonly mode: string }): void } }).status;
			const originalRender = status.render.bind(status);
			status.render = (options: { readonly mode: string }) => {
				if (options.mode === 'failed') {
					throw paintBoom;
				}
				originalRender(options);
			};
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when loadSkillBody catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// loadSkillBody already catches getSkillInfo; a lone inner reject does not leak.
		// Catch-path showBodyStatus throw still needs a call-site catch. A lone
		// `.catch(onUnexpectedError)` leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
				}),
				getSkillInfo: async () => {
					throw new Error('getSkillInfo exploded');
				},
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(section.getMode(), 'ready');
			const loadFailed = localize('ua.engineSkillBodyLoadFailed', "Could not load skill content from the engine.");
			const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
			assert.ok(bodyStatus);
			Object.defineProperty(bodyStatus, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value === loadFailed) {
						throw paintBoom;
					}
				},
			});
			section.selectSkillForTest('demo-skill');
			await flushMicrotasks();
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('New skill opens an input dialog and does not save without a name', async () => {
		let saves = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({ skills: [] }),
			saveSkillContent: async () => {
				saves++;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		const button = section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement | null;
		assert.ok(button);
		assert.strictEqual(button.textContent, '');
		assert.ok(button.classList.contains('codicon-add'));
		button.click();
		await flushMicrotasks();
		assert.strictEqual(saves, 0);
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(writeStatus.textContent?.includes('Skill name is required.'));
		section.getDomNode().parentElement?.remove();
	});

	test('does not leak unhandled rejection when createSkill catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// createSkill() already catches saveSkillContent throw; a lone inner reject does not leak.
		// The void New click still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
				}),
				saveSkillContent: async () => {
					throw new Error('saveSkillContent exploded');
				},
			});
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IUniverseAgentConnection, connection);
			const dialog = instantiationService.get(IDialogService) as TestDialogService;
			dialog.input = async () => ({ confirmed: true, values: ['paint-skill'] });
			const section = store.add(instantiationService.createInstance(EngineSkillsSection, parent));
			section.layout(640, 400);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.isWriteToolbarVisible(), true);
			const createFailed = localize('ua.engineSkillCreateFailed', "Could not create skill content on the engine.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			Object.defineProperty(writeStatus, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value === createFailed) {
						throw paintBoom;
					}
				},
			});
			const newButton = section.getDomNode().querySelector('[aria-label="New skill"]') as HTMLElement | null;
			assert.ok(newButton, 'New write button must be painted');
			newButton.click();
			await flushMicrotasks();
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when saveSelectedSkillBody catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// saveSelectedSkillBody() already catches saveSkillContent throw; a lone inner reject does not leak.
		// The void Save click still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'user-skill', source: 'user', enabled: true }],
				}),
				getSkillInfo: async (request) => ({
					name: request.skillName,
					content: '# Original',
					source: 'user',
					enabled: true,
				}),
				saveSkillContent: async () => {
					throw new Error('saveSkillContent exploded');
				},
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(section.getMode(), 'ready');
			section.selectSkillForTest('user-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
			assert.strictEqual(section.isSaveToolbarVisible(), true);
			const saveFailed = localize('ua.engineSkillBodySaveFailed', "Could not save skill content to the engine.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			Object.defineProperty(writeStatus, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value === saveFailed) {
						throw paintBoom;
					}
				},
			});
			const saveButton = Array.from(section.getDomNode().querySelectorAll('.monaco-button'))
				.find(button => (button.textContent ?? '').includes('Save')) as HTMLElement | undefined;
			assert.ok(saveButton, 'Save write button must be painted');
			saveButton.click();
			await flushMicrotasks();
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when row toggleSkill catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// toggleSkill() already catches setSkillEnabled throw; a lone inner reject does not leak.
		// The row checkbox onChange still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
				}),
				setSkillEnabled: async () => {
					throw new Error('setSkillEnabled exploded');
				},
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			section.layout(640, 160);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.canWrite(), true);
			assertLeftoverSkillsRowTogglesLive(section);
			const toggleFailed = localize('ua.engineSkillToggleFailed', "Could not update skill enablement on the engine.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			Object.defineProperty(writeStatus, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value === toggleFailed) {
						throw paintBoom;
					}
				},
			});
			const toggle = leftoverSkillsRowToggles(section)[0];
			assert.ok(toggle, 'live skill row must paint a toggle');
			toggle.click();
			await flushMicrotasks();
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
