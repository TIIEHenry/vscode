/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListHookPointsResult,
	UniverseAgentListProjectRulesRequest,
	UniverseAgentListProjectRulesResult,
	UniverseAgentProjectRule,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { EngineHooksSection } from '../../browser/engineHooksSection.js';
import { EngineRulesSection } from '../../browser/engineRulesSection.js';

const RULES_FEATURE = 'rules catalog';
const HOOKS_FEATURE = 'hook metadata';

function sampleRule(id: string, title: string): UniverseAgentProjectRule {
	return {
		id,
		title,
		enabled: true,
		priority: 2,
		body: '',
		scope: 2,
		globs: [],
		appliesTo: [],
	};
}

suite('Engine Rules / Hooks list (G-ENG-2/3)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		rulesSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		hooksSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listProjectRules?: (request: UniverseAgentListProjectRulesRequest) => Promise<UniverseAgentListProjectRulesResult>;
		listHookPoints?: () => Promise<UniverseAgentListHookPointsResult>;
	} = {}): IUniverseAgentConnection & {
		setConnected(next: boolean): void;
	} {
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			globalRules: { support: options.rulesSupport ?? 'UNSUPPORTED' },
			projectRules: { support: options.rulesSupport ?? 'UNSUPPORTED' },
			hooksMetadata: { support: options.hooksSupport ?? 'UNSUPPORTED' },
		};
		let connected = options.connected ?? true;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sessionToken: connected ? 'tok' : undefined,
			pairingPending: false,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
		});
		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected,
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
			connect: async () => ({ methods: [], events: [], sessionToken: 'tok' }),
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
			listProjectRules: options.listProjectRules,
			listHookPoints: options.listHookPoints,
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setConnected(next: boolean) {
				connected = next;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('Rules lists Global + Project from proto scopes 2/1 without work_dir', async () => {
		const scopes: number[] = [];
		const connection = createConnectionStub({
			connected: true,
			rulesSupport: 'SUPPORTED',
			listProjectRules: async (request) => {
				scopes.push(request.scope);
				assert.strictEqual(request.sessionId, '');
				assert.ok(!('workDir' in request));
				if (request.scope === 2) {
					return { rules: [sampleRule('g1', 'Always apply')] };
				}
				return { rules: [sampleRule('p1', 'Repo style')] };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.deepStrictEqual(scopes.slice().sort(), [1, 2]);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 2);
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('Always apply'), text);
		assert.ok(text.includes('Repo style'), text);
		parent.remove();
	});

	test('Rules first-pull throw is failed with no leftover rows', async () => {
		const connection = createConnectionStub({
			connected: true,
			rulesSupport: 'SUPPORTED',
			listProjectRules: async () => {
				throw new Error('listProjectRules exploded');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.ok((section.getDomNode().textContent ?? '').includes(getCatalogFailedCopy(RULES_FEATURE, 'listProjectRules exploded')));
		parent.remove();
	});

	test('Rules success then throw keeps leftover rows', async () => {
		let calls = 0;
		const connection = createConnectionStub({
			connected: true,
			rulesSupport: 'SUPPORTED',
			listProjectRules: async (request) => {
				calls++;
				if (calls <= 2) {
					return { rules: request.scope === 2 ? [sampleRule('g1', 'Leftover global')] : [] };
				}
				throw new Error('listProjectRules retry exploded');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('Leftover global'));
		parent.remove();
	});

	test('Hooks lists points and keeps leftover after throw', async () => {
		let calls = 0;
		const connection = createConnectionStub({
			connected: true,
			hooksSupport: 'SUPPORTED',
			listHookPoints: async () => {
				calls++;
				if (calls === 1) {
					return {
						points: [{ id: 'pre', family: 'session', methodName: 'before_turn', installedCount: 2 }],
						catalogRevision: 'r1',
					};
				}
				throw new Error('listHookPoints retry exploded');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineHooksSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('before_turn'));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(calls, 2);
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('before_turn'));
		assert.ok((section.getDomNode().textContent ?? '').includes(getCatalogFailedCopy(HOOKS_FEATURE, 'listHookPoints retry exploded')));
		parent.remove();
	});
});
