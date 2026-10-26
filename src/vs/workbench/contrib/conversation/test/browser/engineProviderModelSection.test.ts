/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListModelsResult,
	UniverseAgentListProviderStatusResult,
	UniverseAgentUpsertModelRequest,
	UniverseAgentProviderPresetCatalog,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IDialogService, type IInput, type IInputResult } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { PROVIDER_CONFIG_UNSUPPORTED_REASON } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy, getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { EngineModelsSection, EngineProvidersSection } from '../../browser/engineProviderModelSection.js';

const LEFTOVER_MODEL_ID = 'gpt-leftover';
const MODEL_FEATURE = 'model registry';
const PROVIDER_FEATURE = 'provider configuration';
const MODEL_EMPTY_COPY = 'No models in the registry.';

suite('Engine providers and models sections', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		looksLive?: boolean;
		pairingPending?: boolean;
		modelsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		providerSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listModels?: () => Promise<UniverseAgentListModelsResult>;
		listProviderStatus?: () => Promise<UniverseAgentListProviderStatusResult>;
		upsertProviderCredentials?: () => Promise<unknown>;
		clearProviderCredentials?: () => Promise<unknown>;
		previewHarnessProviderImport?: () => Promise<{ items: readonly { providerId: string; label: string; source: string }[] }>;
		importHarnessProviders?: () => Promise<unknown>;
		listProviderPresetCatalog?: (request?: { readonly force?: boolean }) => Promise<UniverseAgentProviderPresetCatalog>;
		upsertModel?: () => Promise<unknown>;
		deleteModel?: () => Promise<unknown>;
		setModelEnabled?: () => Promise<unknown>;
		testModelProfile?: () => Promise<unknown>;
	} = {}): IUniverseAgentConnection & {
		setModelsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setProviderSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setConnected(next: boolean): void;
		setPairingPending(value: boolean): void;
	} {
		const modelsCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN' } = {
			support: options.modelsSupport ?? 'SUPPORTED',
		};
		const providerCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'; reason?: string } = {
			support: options.providerSupport ?? 'UNSUPPORTED',
			reason: PROVIDER_CONFIG_UNSUPPORTED_REASON,
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			models: modelsCapability,
			providerConfig: providerCapability,
		};
		let connected = options.connected ?? true;
		let pairingPending = options.pairingPending ?? false;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();

		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			authenticated: connected,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
		});

		return {
			_serviceBrand: undefined,
			isEngineConnected: () => options.looksLive ? connected : (connected && !pairingPending),
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
			listProviderStatus: options.listProviderStatus,
			upsertProviderCredentials: options.upsertProviderCredentials as IUniverseAgentConnection['upsertProviderCredentials'],
			clearProviderCredentials: options.clearProviderCredentials as IUniverseAgentConnection['clearProviderCredentials'],
			previewHarnessProviderImport: options.previewHarnessProviderImport as IUniverseAgentConnection['previewHarnessProviderImport'],
			importHarnessProviders: options.importHarnessProviders as IUniverseAgentConnection['importHarnessProviders'],
			listProviderPresetCatalog: options.listProviderPresetCatalog,
			upsertModel: options.upsertModel as IUniverseAgentConnection['upsertModel'],
			deleteModel: options.deleteModel as IUniverseAgentConnection['deleteModel'],
			setModelEnabled: options.setModelEnabled as IUniverseAgentConnection['setModelEnabled'],
			testModelProfile: options.testModelProfile as IUniverseAgentConnection['testModelProfile'],
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setModelsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				modelsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setProviderSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				providerCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setConnected(next: boolean) {
				connected = next;
				onDidChangeConnection.fire(snapshot());
			},
			setPairingPending(value: boolean) {
				pairingPending = value;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountModels(connection: IUniverseAgentConnection, dialog?: IDialogService): EngineModelsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		if (dialog) {
			instantiationService.stub(IDialogService, dialog);
		}
		const section = store.add(instantiationService.createInstance(EngineModelsSection, parent));
		section.setSectionActive(true);
		section.layout(640, 240);
		return section;
	}

	function mountProviders(connection: IUniverseAgentConnection, dialog?: IDialogService): EngineProvidersSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		if (dialog) {
			instantiationService.stub(IDialogService, dialog);
		}
		const section = store.add(instantiationService.createInstance(EngineProvidersSection, parent));
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
		const section = mountModels(connection);
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
		const section = mountModels(connection);
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

	function getModelList(section: EngineModelsSection): HTMLElement {
		return section.getDomNode().querySelector('.engine-models-list') as HTMLElement;
	}

	function getModelStatus(section: EngineModelsSection): HTMLElement {
		return section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
	}

	function getProviderStatus(section: EngineProvidersSection): HTMLElement {
		return section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
	}

	function assertProviderDisconnectedNotLive(section: EngineProvidersSection): void {
		const status = getProviderStatus(section);
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(text.includes(getEngineSectionDisconnectedCopy()), text);
		assert.ok(!text.includes(getCatalogUnsupportedCopy(PROVIDER_FEATURE, PROVIDER_CONFIG_UNSUPPORTED_REASON)), text);
		assert.ok(!text.includes(getCatalogUnknownCopy()), text);
		assert.notStrictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.notStrictEqual(status.dataset['catalogMode'], 'loading');
	}

	function assertModelsFailedHonesty(
		section: EngineModelsSection,
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
		const section = mountModels(connection);
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
		const section = mountModels(connection);
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

	test('connected phase with pairingPending keeps leftover models and paints not-connected', async () => {
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
		const section = mountModels(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listModelsCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listModelsCalls, listCallsAfterLoad);
		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), leftoverRows);
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_MODEL_ID));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MODEL_EMPTY_COPY));
		const leftoverList = getModelList(section);
		assert.ok(leftoverList);
		assert.notStrictEqual(leftoverList.style.display, 'none');
		const status = getModelStatus(section);
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('leftover-looks-live pairing-hold keeps leftover models and skips listModels', async () => {
		let listModelsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			looksLive: true,
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
		const section = mountModels(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listModelsCalls;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(listModelsCalls, listCallsAfterLoad, 'leftover-looks-live must not extra listModels');
		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), leftoverRows);
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_MODEL_ID));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MODEL_EMPTY_COPY));
		const leftoverList = getModelList(section);
		assert.ok(leftoverList);
		assert.notStrictEqual(leftoverList.style.display, 'none');
		const status = getModelStatus(section);
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('不代表已配置凭据'));
	});

	test('leftover-looks-live pairing-hold paints provider group disconnected, not capability/unsupported-as-live', async () => {
		const connection = createConnectionStub({
			connected: true,
			pairingPending: true,
			looksLive: true,
			providerSupport: 'UNSUPPORTED',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const section = mountProviders(connection);
		await flushMicrotasks();
		assertProviderDisconnectedNotLive(section);
	});

	test('leftover-looks-live UNKNOWN provider capability still paints disconnected, not capability loading', async () => {
		const connection = createConnectionStub({
			connected: true,
			pairingPending: true,
			looksLive: true,
			providerSupport: 'UNKNOWN',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const section = mountProviders(connection);
		await flushMicrotasks();
		assertProviderDisconnectedNotLive(section);
	});

	test('true connected without pairing keeps provider capability/unsupported fold', async () => {
		const connection = createConnectionStub({
			connected: true,
			pairingPending: false,
			providerSupport: 'UNSUPPORTED',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountProviders(connection);
		await flushMicrotasks();
		const status = getProviderStatus(section);
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(text.includes(getCatalogUnsupportedCopy(PROVIDER_FEATURE, PROVIDER_CONFIG_UNSUPPORTED_REASON)), text);
		assert.ok(!text.includes(getEngineSectionDisconnectedCopy()), text);
	});

	test('true connected UNKNOWN provider capability still paints capability loading', async () => {
		const connection = createConnectionStub({
			connected: true,
			pairingPending: false,
			providerSupport: 'UNKNOWN',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountProviders(connection);
		await flushMicrotasks();
		const status = getProviderStatus(section);
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(text.includes(getCatalogUnknownCopy()), text);
		assert.ok(!text.includes(getEngineSectionDisconnectedCopy()), text);
	});

	test('true disconnect still paints provider group disconnected', async () => {
		const connection = createConnectionStub({
			connected: false,
			pairingPending: false,
			providerSupport: 'UNSUPPORTED',
		});
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountProviders(connection);
		await flushMicrotasks();
		assertProviderDisconnectedNotLive(section);
	});

	test('listProviderStatus paints read-only rows and never shows api_key', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({
				providers: [{
					providerId: 'anthropic',
					brand: 'Anthropic',
					protocol: 'anthropic',
					configured: true,
					credentialSource: 'PROVIDER_ENV',
					hasBaseUrl: true,
					enabled: true,
				}],
			}),
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('Anthropic'), text);
		assert.ok(text.includes('Configured'), text);
		assert.ok(!text.includes('api_key'), text);
		assert.strictEqual(section.getDomNode().querySelector('input:not(.engine-provider-catalog-filter)'), null, 'no credential inputs');
		const toolbar = section.getDomNode().querySelector('.engine-catalog-write-toolbar') as HTMLElement;
		assert.strictEqual(toolbar.style.display, 'none');
	});

	test('provider enabled status is plain text and does not call a missing provider API', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({
				providers: [{
					providerId: 'anthropic',
					brand: 'Anthropic',
					protocol: 'anthropic',
					configured: true,
					credentialSource: 'PROVIDER_ENV',
					hasBaseUrl: true,
					enabled: true,
				}],
			}),
		});
		const section = mountProviders(connection);
		await flushMicrotasks();
		const status = section.getDomNode().querySelector<HTMLElement>('.engine-provider-enabled-status');
		assert.ok(status);
		status.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		status.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', keyCode: 32, bubbles: true, cancelable: true }));
		assert.deepStrictEqual({
			text: status.textContent,
			role: status.getAttribute('role'),
			tabIndex: status.tabIndex,
			switch: section.getDomNode().querySelector('.engine-provider-switch, [role="switch"]'),
		}, { text: 'Enabled', role: null, tabIndex: -1, switch: null });
	});

	test('import control appears only when desktop provider write hooks exist', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({ providers: [] }),
			upsertProviderCredentials: async () => ({ providerId: 'local' }),
			clearProviderCredentials: async () => ({ providerId: 'local' }),
			previewHarnessProviderImport: async () => ({ items: [] }),
			importHarnessProviders: async () => ({ imported: 0, updated: 0, skipped: 0, modelWrites: 0, errors: [] }),
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'empty');
		const toolbar = section.getDomNode().querySelector('.engine-catalog-write-toolbar') as HTMLElement;
		assert.notStrictEqual(toolbar.style.display, 'none');
		const importButton = toolbar.querySelector('[aria-label="Import from local harnesses"]');
		assert.ok(importButton);
		assert.ok(importButton.classList.contains('codicon-desktop-download'));
		assert.strictEqual(importButton.textContent, '');
		const addProvider = toolbar.querySelector('[aria-label="Add provider"]');
		assert.ok(addProvider?.classList.contains('codicon-add'));
		assert.strictEqual(section.getDomNode().querySelector('input:not(.engine-provider-catalog-filter)'), null);
	});

	test('add provider opens an input dialog and does not paint credential fields', async () => {
		const seen: { request?: { providerId: string; apiKey: string; baseUrl: string; protocol: string } } = {};
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({ providers: [] }),
			upsertProviderCredentials: (async (request: { providerId: string; apiKey: string; baseUrl: string; protocol: string }) => {
				seen.request = request;
				return { providerId: request.providerId };
			}) as unknown as () => Promise<unknown>,
			clearProviderCredentials: async () => ({ providerId: 'local' }),
		});
		const dialog = new class extends TestDialogService {
			lastInput: IInput | undefined;
			override async input(input: IInput): Promise<IInputResult> {
				this.lastInput = input;
				return {
					confirmed: true,
					values: ['local', 'openai', 'https://example.test', 'sk-secret'],
				};
			}
		}();
		const section = mountProviders(connection, dialog);
		await flushMicrotasks();
		const addProvider = section.getDomNode().querySelector('[aria-label="Add provider"]') as HTMLElement;
		addProvider.click();
		await flushMicrotasks();

		assert.strictEqual(dialog.lastInput?.message, 'Add provider');
		assert.strictEqual(dialog.lastInput?.inputs.length, 4);
		assert.strictEqual(dialog.lastInput?.inputs[3]?.type, 'password');
		assert.deepStrictEqual(seen.request, {
			providerId: 'local',
			protocol: 'openai',
			baseUrl: 'https://example.test',
			apiKey: 'sk-secret',
		});
		assert.strictEqual(section.getDomNode().querySelector('input:not(.engine-provider-catalog-filter)'), null);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('sk-secret'));
	});

	test('provider action feedback clears when capability becomes UNKNOWN', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({ providers: [] }),
			upsertProviderCredentials: async () => ({ providerId: 'local' }),
			clearProviderCredentials: async () => ({ providerId: 'local' }),
		});
		const dialog = new class extends TestDialogService {
			override async input(_input: IInput): Promise<IInputResult> {
				return { confirmed: true, values: ['local', 'openai', '', 'sk-secret'] };
			}
		}();
		const section = mountProviders(connection, dialog);
		await flushMicrotasks();

		const actionMessage = section.getDomNode().querySelector('.engine-catalog-action-message') as HTMLElement;
		assert.strictEqual(actionMessage.textContent, '');
		assert.strictEqual(actionMessage.style.display, 'none');
		const addProvider = section.getDomNode().querySelector('[aria-label="Add provider"]') as HTMLElement;
		assert.ok(addProvider);
		addProvider.click();
		await flushMicrotasks();
		assert.ok(actionMessage.textContent?.includes('Provider saved.'), actionMessage.textContent);
		assert.notStrictEqual(actionMessage.style.display, 'none');

		connection.setProviderSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(actionMessage.textContent, '');
		assert.strictEqual(actionMessage.style.display, 'none');
	});

	test('built-in presets render without a cloud method and the filter hides rows', async () => {
		const connection = createConnectionStub({ connected: false });
		const section = mountProviders(connection);
		await flushMicrotasks();

		const builtin = section.getDomNode().querySelector('.engine-provider-builtin-list');
		assert.ok(builtin);
		const names = () => [...builtin.querySelectorAll('.engine-catalog-name')].map(node => node.textContent);
		assert.ok(names().includes('OpenAI / Compatible API'));
		assert.ok(names().includes('DeepSeek (Anthropic API)'));
		assert.ok(!names().includes('Custom'));
		assert.ok((builtin.querySelector('.engine-catalog-description')?.textContent ?? '').includes('api.openai.com'));
		assert.strictEqual(section.getDomNode().querySelector('.engine-provider-cloud-status')?.textContent, 'Cloud catalog loads in the desktop app.');
		assert.strictEqual(section.getDomNode().querySelector('.engine-provider-cloud-list')?.childElementCount, 0);
		assert.strictEqual(section.getDomNode().querySelector('[aria-label="Refresh cloud catalog"]'), null);
		assert.strictEqual(builtin.querySelector('.engine-catalog-row-actions'), null);
		assert.strictEqual(section.getListEntryCount(), 0);

		const filter = section.getDomNode().querySelector('.engine-provider-catalog-filter') as HTMLInputElement;
		const noMatch = section.getDomNode().querySelector('.engine-provider-catalog-filter-empty') as HTMLElement;
		assert.strictEqual(noMatch.textContent, '');
		assert.strictEqual(noMatch.style.display, 'none');
		const InputEvent = filter.ownerDocument.defaultView!.Event;
		filter.value = 'zzz';
		filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
		assert.strictEqual(builtin.querySelector('.engine-catalog-name'), null);
		assert.strictEqual(noMatch.textContent, 'No matching providers.');
		assert.notStrictEqual(noMatch.style.display, 'none');
		assert.strictEqual(section.getDomNode().querySelector('.engine-provider-cloud-status')?.textContent, 'Cloud catalog loads in the desktop app.');
		filter.value = 'openai';
		filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
		assert.deepStrictEqual(names(), ['OpenAI / Compatible API']);
		assert.strictEqual(noMatch.textContent, '');
		assert.strictEqual(noMatch.style.display, 'none');
		filter.value = '   ';
		filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
		assert.ok(names().includes('OpenAI / Compatible API'));
		assert.strictEqual(noMatch.textContent, '');
		assert.strictEqual(noMatch.style.display, 'none');
	});

	test('a filter with no preset hits says so only after the cloud catalog settles', async () => {
		let releaseCatalog!: (catalog: UniverseAgentProviderPresetCatalog) => void;
		const pending = new Promise<UniverseAgentProviderPresetCatalog>(resolve => {
			releaseCatalog = resolve;
		});
		const openai = {
			id: 'openai',
			displayName: 'OpenAI / Compatible API',
			defaultApiBaseUrl: 'https://api.openai.com/v1',
			defaultProtocol: 'openai',
			defaultModels: ['gpt-4o'],
			quickPick: true,
		};
		const groq = {
			id: 'groq',
			displayName: 'Groq',
			defaultApiBaseUrl: 'https://api.groq.com/openai/v1',
			defaultProtocol: 'openai',
			defaultModels: ['llama-3'],
			quickPick: false,
		};
		const connection = createConnectionStub({
			connected: true,
			listProviderPresetCatalog: () => pending,
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		const filter = section.getDomNode().querySelector('.engine-provider-catalog-filter') as HTMLInputElement;
		const noMatch = section.getDomNode().querySelector('.engine-provider-catalog-filter-empty') as HTMLElement;
		const cloudStatus = section.getDomNode().querySelector('.engine-provider-cloud-status') as HTMLElement;
		const InputEvent = filter.ownerDocument.defaultView!.Event;
		filter.value = 'zzz';
		filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
		assert.strictEqual(section.getDomNode().querySelector('.engine-provider-builtin-list .engine-catalog-name'), null);
		assert.strictEqual(cloudStatus.textContent, 'Reading the cloud catalog…');
		assert.strictEqual(noMatch.textContent, '');
		assert.strictEqual(noMatch.style.display, 'none');

		releaseCatalog({
			builtin: [openai],
			cloud: [groq],
			cloudStatus: 'loaded',
		});
		await flushMicrotasks();
		assert.strictEqual(noMatch.textContent, 'No matching providers.');
		assert.notStrictEqual(noMatch.style.display, 'none');
		assert.strictEqual(cloudStatus.textContent, '');
		assert.strictEqual(cloudStatus.style.display, 'none');

		filter.value = 'groq';
		filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
		assert.deepStrictEqual(
			[...section.getDomNode().querySelectorAll('.engine-provider-cloud-list .engine-catalog-name')].map(node => node.textContent),
			['Groq'],
		);
		assert.strictEqual(noMatch.textContent, '');
		assert.strictEqual(noMatch.style.display, 'none');
	});

	test('an unavailable cloud catalog keeps its status beside a filter miss', async () => {
		const connection = createConnectionStub({
			connected: true,
			listProviderPresetCatalog: async () => ({
				builtin: [{
					id: 'openai',
					displayName: 'OpenAI / Compatible API',
					defaultApiBaseUrl: 'https://api.openai.com/v1',
					defaultProtocol: 'openai',
					defaultModels: ['gpt-4o'],
					quickPick: true,
				}],
				cloud: [],
				cloudStatus: 'unavailable',
				cloudError: 'offline',
			}),
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		const filter = section.getDomNode().querySelector('.engine-provider-catalog-filter') as HTMLInputElement;
		const noMatch = section.getDomNode().querySelector('.engine-provider-catalog-filter-empty') as HTMLElement;
		const cloudStatus = section.getDomNode().querySelector('.engine-provider-cloud-status') as HTMLElement;
		const InputEvent = filter.ownerDocument.defaultView!.Event;
		filter.value = 'zzz';
		filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
		assert.strictEqual(noMatch.textContent, 'No matching providers.');
		assert.strictEqual(cloudStatus.textContent, 'offline');
		assert.notStrictEqual(cloudStatus.style.display, 'none');
	});

	test('desktop cloud catalog renders a cloud row and refresh asks for a fresh copy', async () => {
		const calls: Array<boolean | undefined> = [];
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({ providers: [] }),
			listProviderPresetCatalog: async request => {
				calls.push(request?.force);
				return {
					builtin: [{
						id: 'openai',
						displayName: 'OpenAI / Compatible API',
						defaultApiBaseUrl: 'https://api.openai.com/v1',
						defaultProtocol: 'openai',
						defaultModels: ['gpt-4o'],
						quickPick: true,
					}],
					cloud: [{
						id: 'groq',
						displayName: 'Groq',
						defaultApiBaseUrl: 'https://api.groq.com/openai/v1',
						defaultProtocol: 'openai',
						defaultModels: ['llama-3'],
						quickPick: false,
					}],
					cloudStatus: 'loaded',
				};
			},
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		assert.deepStrictEqual(calls, [undefined]);
		const builtinNames = [...section.getDomNode().querySelectorAll('.engine-provider-builtin-list .engine-catalog-name')].map(node => node.textContent);
		const cloudNames = [...section.getDomNode().querySelectorAll('.engine-provider-cloud-list .engine-catalog-name')].map(node => node.textContent);
		assert.deepStrictEqual(builtinNames, ['OpenAI / Compatible API']);
		assert.deepStrictEqual(cloudNames, ['Groq']);
		assert.ok((section.getDomNode().querySelector('.engine-provider-cloud-list .engine-catalog-description')?.textContent ?? '').includes('api.groq.com'));
		const cloudStatus = section.getDomNode().querySelector('.engine-provider-cloud-status') as HTMLElement;
		assert.strictEqual(cloudStatus.textContent, '');
		assert.strictEqual(cloudStatus.style.display, 'none');
		assert.strictEqual(section.getListEntryCount(), 0);

		const refresh = section.getDomNode().querySelector('[aria-label="Refresh cloud catalog"]') as HTMLElement;
		assert.ok(refresh.classList.contains('codicon-refresh'));
		refresh.click();
		await flushMicrotasks();
		assert.deepStrictEqual(calls, [undefined, true]);
	});

	test('adding a built-in preset opens the credential dialog with id, protocol, and base URL', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({ providers: [] }),
			upsertProviderCredentials: async () => ({ providerId: 'openai' }),
			clearProviderCredentials: async () => ({ providerId: 'openai' }),
		});
		const dialog = new class extends TestDialogService {
			lastInput: IInput | undefined;
			override async input(input: IInput): Promise<IInputResult> {
				this.lastInput = input;
				return { confirmed: false };
			}
		}();
		const section = mountProviders(connection, dialog);
		await flushMicrotasks();

		const add = section.getDomNode().querySelector('.engine-provider-builtin-list [aria-label="Add OpenAI / Compatible API"]') as HTMLElement;
		assert.ok(add.classList.contains('codicon-add'));
		assert.strictEqual(add.textContent, '');
		add.click();
		await flushMicrotasks();

		assert.strictEqual(dialog.lastInput?.message, 'Add provider');
		assert.strictEqual(dialog.lastInput?.inputs[0]?.value, 'openai');
		assert.strictEqual(dialog.lastInput?.inputs[1]?.value, 'openai');
		assert.strictEqual(dialog.lastInput?.inputs[2]?.value, 'https://api.openai.com/v1');
		assert.strictEqual(dialog.lastInput?.inputs[3]?.type, 'password');
		assert.strictEqual(section.getDomNode().querySelector('input[type="password"]'), null);
	});

	test('a cloud catalog failure keeps the built-in list and shows the error', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'UNSUPPORTED',
			listProviderPresetCatalog: async () => {
				throw new Error('catalog boom');
			},
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		const names = [...section.getDomNode().querySelectorAll('.engine-provider-builtin-list .engine-catalog-name')].map(node => node.textContent);
		assert.ok(names.includes('OpenAI / Compatible API'));
		const cloudStatus = section.getDomNode().querySelector('.engine-provider-cloud-status')?.textContent ?? '';
		assert.ok(cloudStatus.includes('Cloud catalog is unavailable'));
		assert.ok(cloudStatus.includes('catalog boom'));
		assert.strictEqual(section.getDomNode().querySelector('.engine-provider-builtin-list .engine-catalog-row-actions'), null);
	});

	test('model add and row actions appear only when registry write hooks exist', async () => {
		const readOnly = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => ({
				models: [{
					id: 'demo:m',
					type: 'general',
					enabled: true,
					level: 5,
					provider: 'demo',
					modelId: 'm',
				}],
			}),
		});
		const readOnlySection = mountModels(readOnly);
		await flushMicrotasks();
		assert.strictEqual(readOnlySection.getDomNode().querySelector('.engine-catalog-write-toolbar')?.textContent ?? '', '');
		assert.strictEqual(readOnlySection.getDomNode().querySelector('.engine-catalog-row-actions'), null);

		const writable = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => ({
				models: [{
					id: 'demo:m',
					type: 'general',
					enabled: true,
					level: 5,
					provider: 'demo',
					modelId: 'm',
				}],
			}),
			upsertModel: async () => ({ id: 'demo:m' }),
			deleteModel: async () => ({ deleted: true }),
			setModelEnabled: async () => ({ id: 'demo:m' }),
			testModelProfile: async () => ({ ok: true }),
		});
		const section = mountModels(writable);
		await flushMicrotasks();
		const toolbar = section.getDomNode().querySelector('.engine-catalog-write-toolbar') as HTMLElement;
		assert.notStrictEqual(toolbar.style.display, 'none');
		const addModel = toolbar.querySelector('[aria-label="Add model"]');
		assert.ok(addModel?.classList.contains('codicon-add'));
		assert.strictEqual(addModel?.textContent, '');
		const actions = section.getDomNode().querySelector('.engine-catalog-row-actions');
		assert.ok(actions);
		assert.ok(actions.querySelector('[aria-label="Disable m"]')?.classList.contains('codicon-circle-slash'));
		assert.ok(actions.querySelector('[aria-label="Test m"]')?.classList.contains('codicon-beaker'));
		assert.ok(actions.querySelector('[aria-label="Edit m"]')?.classList.contains('codicon-edit'));
		assert.ok(actions.querySelector('[aria-label="Delete m"]')?.classList.contains('codicon-trash'));
	});

	test('delete model confirms in a popover and does not open a native dialog', async () => {
		let deleted = 0;
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => ({
				models: [{
					id: 'demo:m',
					type: 'general',
					enabled: true,
					level: 5,
					provider: 'demo',
					modelId: 'm',
				}],
			}),
			deleteModel: (async () => {
				deleted++;
				return { deleted: true };
			}) as unknown as () => Promise<unknown>,
			upsertModel: async () => ({ id: 'demo:m' }),
			setModelEnabled: async () => ({ id: 'demo:m' }),
		});
		const dialog = new class extends TestDialogService {
			override async confirm(): Promise<never> {
				throw new Error('native confirm');
			}
		}();
		const section = mountModels(connection, dialog);
		await flushMicrotasks();
		const button = section.getDomNode().querySelector('[aria-label="Delete m"]') as HTMLElement;
		button.click();
		await flushMicrotasks();
		assert.strictEqual(deleted, 0);
		const popup = document.querySelector('.engine-confirm-popover');
		assert.ok(popup?.textContent?.includes('Delete model "m"?'));
		assert.ok(popup?.textContent?.includes('This removes the model from the engine registry.'));
		(document.querySelector('.engine-confirm-popover-cancel') as HTMLButtonElement).click();
		await flushMicrotasks();
		assert.strictEqual(deleted, 0);

		button.click();
		await flushMicrotasks();
		(document.querySelector('.engine-confirm-popover-confirm') as HTMLButtonElement).click();
		await flushMicrotasks();
		assert.strictEqual(deleted, 1);
	});

	test('edit model keeps a blank description and sends typed cost and speed', async () => {
		const seen: { request?: UniverseAgentUpsertModelRequest } = {};
		let deleted = 0;
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => ({
				models: [{
					id: 'demo:m',
					type: 'general',
					enabled: false,
					level: 5,
					description: 'kept summary',
					speed: 'old-speed',
					provider: 'demo',
					modelId: 'm',
				}],
			}),
			upsertModel: (async (request: UniverseAgentUpsertModelRequest) => {
				seen.request = request;
				return { id: request.id };
			}) as unknown as () => Promise<unknown>,
			deleteModel: (async () => {
				deleted++;
				return { deleted: true };
			}) as unknown as () => Promise<unknown>,
			setModelEnabled: async () => ({ id: 'demo:m' }),
		});
		const dialog = new class extends TestDialogService {
			lastInput: IInput | undefined;
			override async input(input: IInput): Promise<IInputResult> {
				this.lastInput = input;
				return {
					confirmed: true,
					values: ['demo', 'm', 'general', '5', '   ', '  cheap  ', '  fast  '],
				};
			}
		}();
		const section = mountModels(connection, dialog);
		await flushMicrotasks();
		const edit = section.getDomNode().querySelector('[aria-label="Edit m"]') as HTMLElement;
		edit.click();
		await flushMicrotasks();

		assert.strictEqual(dialog.lastInput?.message, 'Edit model');
		assert.strictEqual(dialog.lastInput?.inputs.length, 7);
		assert.strictEqual(dialog.lastInput?.inputs[3]?.label, 'Level (optional, 1–9)');
		assert.strictEqual(dialog.lastInput?.inputs[4]?.label, 'Description');
		assert.strictEqual(dialog.lastInput?.inputs[4]?.placeholder, 'Description');
		assert.strictEqual(dialog.lastInput?.inputs[4]?.value, 'kept summary');
		assert.strictEqual(dialog.lastInput?.inputs[5]?.label, 'Cost');
		assert.strictEqual(dialog.lastInput?.inputs[5]?.placeholder, 'Cost');
		assert.strictEqual(dialog.lastInput?.inputs[5]?.value, '');
		assert.strictEqual(dialog.lastInput?.inputs[6]?.label, 'Speed');
		assert.strictEqual(dialog.lastInput?.inputs[6]?.placeholder, 'Speed');
		assert.strictEqual(dialog.lastInput?.inputs[6]?.value, 'old-speed');
		const detail = dialog.lastInput?.detail ?? '';
		assert.ok(typeof detail === 'string');
		assert.ok(detail.includes('Leave it blank to keep the current level.'));
		assert.ok(detail.includes('A blank description, cost, or speed keeps the current value.'));
		assert.ok(detail.includes('On add, a blank description, cost, or speed is saved as empty.'));
		const validate = dialog.lastInput?.validate;
		assert.strictEqual(validate?.(['demo', 'm', 'general', '5', '', 'cheap', 'fast']), undefined);
		assert.strictEqual(validate?.(['', '', 'general', '5', 'note', 'cheap', 'fast']), 'Provider and model id are required.');
		assert.strictEqual(validate?.(['demo', 'm', 'general', '0', 'note', 'not-a-level', '@@@']), 'Level must be a whole number from 1 to 9, or left blank.');
		assert.strictEqual(validate?.(['demo', 'm', '', '', 'whatever', 'not-a-level', '@@@']), undefined);
		assert.deepStrictEqual(seen.request, {
			id: 'demo:m',
			type: 'general',
			enabled: false,
			level: 5,
			description: 'kept summary',
			cost: 'cheap',
			speed: 'fast',
			provider: 'demo',
			modelId: 'm',
		});
		assert.strictEqual(deleted, 0);
		assert.strictEqual(section.getDomNode().querySelector('input:not(.engine-provider-catalog-filter)'), null);
	});

	test('add model sends empty description, cost, and speed when those fields are blank', async () => {
		const seen: { request?: UniverseAgentUpsertModelRequest } = {};
		const connection = createConnectionStub({
			connected: true,
			modelsSupport: 'SUPPORTED',
			listModels: async () => ({ models: [] }),
			upsertModel: (async (request: UniverseAgentUpsertModelRequest) => {
				seen.request = request;
				return { id: request.id };
			}) as unknown as () => Promise<unknown>,
			deleteModel: async () => ({ deleted: true }),
			setModelEnabled: async () => ({ id: 'acme:neo' }),
		});
		const dialog = new class extends TestDialogService {
			lastInput: IInput | undefined;
			override async input(input: IInput): Promise<IInputResult> {
				this.lastInput = input;
				return {
					confirmed: true,
					values: [' acme ', ' neo ', '', '', '   ', '', ''],
				};
			}
		}();
		const section = mountModels(connection, dialog);
		await flushMicrotasks();
		const addModel = section.getDomNode().querySelector('[aria-label="Add model"]') as HTMLElement;
		addModel.click();
		await flushMicrotasks();

		assert.strictEqual(dialog.lastInput?.message, 'Add model');
		assert.strictEqual(dialog.lastInput?.inputs.length, 7);
		assert.strictEqual(dialog.lastInput?.inputs[0]?.value, '');
		assert.strictEqual(dialog.lastInput?.inputs[1]?.value, '');
		assert.strictEqual(dialog.lastInput?.inputs[2]?.value, 'general');
		assert.strictEqual(dialog.lastInput?.inputs[3]?.value, '');
		assert.strictEqual(dialog.lastInput?.inputs[4]?.value, '');
		assert.strictEqual(dialog.lastInput?.inputs[5]?.value, '');
		assert.strictEqual(dialog.lastInput?.inputs[6]?.value, '');
		assert.deepStrictEqual(seen.request, {
			id: 'acme:neo',
			type: 'general',
			enabled: true,
			level: 0,
			description: '',
			cost: '',
			speed: '',
			provider: 'acme',
			modelId: 'neo',
		});
		assert.strictEqual(section.getDomNode().querySelector('input:not(.engine-provider-catalog-filter)'), null);
	});

	test('listProviderStatus first-pull throw is failed with no leftover rows', async () => {
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => {
				throw new Error('listProviderStatus exploded');
			},
		});
		const section = mountProviders(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.ok((section.getDomNode().textContent ?? '').includes(getCatalogFailedCopy('provider configuration', 'listProviderStatus exploded')));
	});

	test('listProviderStatus success then throw keeps leftover rows', async () => {
		let calls = 0;
		const connection = createConnectionStub({
			connected: true,
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => {
				calls++;
				if (calls === 1) {
					return {
						providers: [{
							providerId: 'anthropic',
							brand: 'Anthropic leftover',
							protocol: 'anthropic',
							configured: false,
							credentialSource: 'NONE',
							hasBaseUrl: false,
							enabled: true,
						}],
					};
				}
				throw new Error('listProviderStatus retry exploded');
			},
		});
		const section = mountProviders(connection);
		await flushMicrotasks();
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(calls, 2);
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('Anthropic leftover'));
	});

	test('does not leak unhandled rejection when refreshProviders catch-path render throws and onUnexpectedError warn-then-rethrows', async () => {
		// refreshProviders() already catches list throw; a lone inner reject does not leak.
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
				providerSupport: 'SUPPORTED',
				listProviderStatus: async () => {
					throw new Error('listProviderStatus boom');
				},
			});
			const section = mountProviders(connection);
			const providerStatus = (section as unknown as { providerStatus: { render(options: { readonly mode: string }): void } }).providerStatus;
			const originalRender = providerStatus.render.bind(providerStatus);
			providerStatus.render = (options: { readonly mode: string }) => {
				if (options.mode === 'failed') {
					throw paintBoom;
				}
				originalRender(options);
			};
			await timeout(0);
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

	test('does not leak unhandled rejection when refreshModels catch-path render throws and onUnexpectedError warn-then-rethrows', async () => {
		// refreshModels() already catches list throw; a lone inner reject does not leak.
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
				listModels: async () => {
					throw new Error('listModels boom');
				},
			});
			const section = mountModels(connection);
			const modelStatus = (section as unknown as { modelStatus: { render(options: { readonly mode: string }): void } }).modelStatus;
			const originalRender = modelStatus.render.bind(modelStatus);
			modelStatus.render = (options: { readonly mode: string }) => {
				if (options.mode === 'failed') {
					throw paintBoom;
				}
				originalRender(options);
			};
			await timeout(0);
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
