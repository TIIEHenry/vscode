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
	UniverseAgentListModelsResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy } from '../../browser/engineCatalog.js';
import { EngineProviderModelSection } from '../../browser/engineProviderModelSection.js';

const LEFTOVER_MODEL_ID = 'gpt-leftover';
const MODEL_FEATURE = 'model registry';
const MODEL_EMPTY_COPY = 'No models in the registry.';

suite('EngineProviderModelSection UNKNOWN leftover (D209)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		modelsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listModels?: () => Promise<UniverseAgentListModelsResult>;
	} = {}): IUniverseAgentConnection & {
		setModelsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setConnected(next: boolean): void;
	} {
		const modelsCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN' } = {
			support: options.modelsSupport ?? 'SUPPORTED',
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			models: modelsCapability,
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
			listModels: options.listModels ?? (async () => ({ models: [] })),
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setModelsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				modelsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setConnected(next: boolean) {
				connected = next;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountSection(connection: IUniverseAgentConnection): EngineProviderModelSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineProviderModelSection, parent));
		section.setSectionActive(true);
		section.layout(640, 240);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listModelsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => {
				listModelsCalls++;
				return {
					models: [{
						id: 'leftover',
						type: 'chat',
						enabled: true,
						level: 1,
						provider: 'demo',
						modelId: LEFTOVER_MODEL_ID,
					}],
				};
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_MODEL_ID));
		const listAfterLoad = getModelList(section);
		assert.ok(listAfterLoad);
		assert.notStrictEqual(listAfterLoad.style.display, 'none');
		const listCallsAfterLoad = listModelsCalls;

		connection.setModelsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_MODEL_ID));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MODEL_EMPTY_COPY));
		assert.strictEqual(listModelsCalls, listCallsAfterLoad);
		const leftoverList = getModelList(section);
		assert.ok(leftoverList);
		assert.notStrictEqual(leftoverList.style.display, 'none');
		const status = getModelStatus(section);
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
	});

	test('first-pull capability UNKNOWN is empty with capability loading and does not list', async () => {
		let listModelsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'UNKNOWN',
			listModels: async () => {
				listModelsCalls++;
				return {
					models: [{
						id: 'fake',
						type: 'chat',
						enabled: true,
						level: 1,
						provider: 'demo',
						modelId: 'should-not-appear',
					}],
				};
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(listModelsCalls, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MODEL_EMPTY_COPY));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('should-not-appear'));
		const list = getModelList(section);
		assert.ok(list);
		assert.strictEqual(list.style.display, 'none');
		const status = getModelStatus(section);
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
	});

	function getModelList(section: EngineProviderModelSection): HTMLElement {
		return section.getDomNode().querySelector('.engine-provider-model-list') as HTMLElement;
	}

	function getModelStatus(section: EngineProviderModelSection): HTMLElement {
		return section.getDomNode().querySelector(
			'.engine-provider-model-group--model .engine-catalog-status-widget',
		) as HTMLElement;
	}

	function assertModelsFailedHonesty(
		section: EngineProviderModelSection,
		errorMessage: string,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		const status = getModelStatus(section);
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(MODEL_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MODEL_EMPTY_COPY));
	}

	test('listModels first-pull throw is failed with no leftover rows', async () => {
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => {
				throw new Error('listModels exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assertModelsFailedHonesty(section, 'listModels exploded', 0);
		const list = getModelList(section);
		assert.ok(list);
		assert.strictEqual(list.style.display, 'none');
	});

	test('listModels success then throw keeps leftover rows and paints failed', async () => {
		let listModelsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => {
				listModelsCalls++;
				if (listModelsCalls === 1) {
					return {
						models: [{
							id: 'leftover',
							type: 'chat',
							enabled: true,
							level: 1,
							provider: 'demo',
							modelId: LEFTOVER_MODEL_ID,
						}],
					};
				}
				throw new Error('listModels retry exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const listAfterLoad = getModelList(section);
		assert.ok(listAfterLoad);
		assert.notStrictEqual(listAfterLoad.style.display, 'none');
		assert.strictEqual(listModelsCalls, 1);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MODEL_EMPTY_COPY));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listModelsCalls, 2);
		assertModelsFailedHonesty(section, 'listModels retry exploded', 1);
		const leftoverList = getModelList(section);
		assert.ok(leftoverList);
		assert.notStrictEqual(leftoverList.style.display, 'none');
	});
});
