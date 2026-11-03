/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { CancellationError, errorHandler, isCancellationError, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { hasKey } from '../../../../../base/common/types.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot, PROVIDER_CONFIG_UNSUPPORTED_REASON } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentExpectedOwner } from '../../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
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
		listModels?: (expectedOwner?: UniverseAgentExpectedOwner) => Promise<UniverseAgentListModelsResult>;
		listProviderStatus?: (expectedOwner?: UniverseAgentExpectedOwner) => Promise<UniverseAgentListProviderStatusResult>;
		upsertProviderCredentials?: (...args: Parameters<NonNullable<IUniverseAgentConnection['upsertProviderCredentials']>>) => Promise<unknown>;
		clearProviderCredentials?: (...args: Parameters<NonNullable<IUniverseAgentConnection['clearProviderCredentials']>>) => Promise<unknown>;
		previewHarnessProviderImport?: () => Promise<{ items: readonly { providerId: string; label: string; source: string }[] }>;
		importHarnessProviders?: (...args: Parameters<NonNullable<IUniverseAgentConnection['importHarnessProviders']>>) => Promise<unknown>;
		listProviderPresetCatalog?: (request?: { readonly force?: boolean }) => Promise<UniverseAgentProviderPresetCatalog>;
		upsertModel?: (...args: Parameters<NonNullable<IUniverseAgentConnection['upsertModel']>>) => Promise<unknown>;
		deleteModel?: (...args: Parameters<NonNullable<IUniverseAgentConnection['deleteModel']>>) => Promise<unknown>;
		setModelEnabled?: (...args: Parameters<NonNullable<IUniverseAgentConnection['setModelEnabled']>>) => Promise<unknown>;
		testModelProfile?: (...args: Parameters<NonNullable<IUniverseAgentConnection['testModelProfile']>>) => Promise<unknown>;
	} = {}): IUniverseAgentConnection & {
		setModelsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setProviderSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setConnected(next: boolean): void;
		setPairingPending(value: boolean): void;
		setPublishedLink(engineIdentityId: string | undefined, linkId: number | undefined, notify?: boolean): void;
		setLinkId(value: number): void;
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
		let engineIdentityId: string | undefined = 'engine-test';
		let linkId: number | undefined = 1;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();

		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			authenticated: connected,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
			engineIdentityId,
			linkId,
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
			setPublishedLink(identity: string | undefined, serial: number | undefined, notify = true) {
				engineIdentityId = identity;
				linkId = serial;
				if (notify) { onDidChangeConnection.fire(snapshot()); }
			},
			setLinkId(value: number) {
				linkId = value;
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

	const ownershipModel = { id: 'demo:m', type: 'general', enabled: true, level: 3, provider: 'demo', modelId: 'm' };

	function createWritableConnection(options: Parameters<typeof createConnectionStub>[0] = {}) {
		return createConnectionStub({
			providerSupport: 'SUPPORTED',
			listProviderStatus: async () => ({ providers: [{ providerId: 'demo', brand: 'Demo', protocol: 'openai', configured: true, credentialSource: 'FILE', hasBaseUrl: true, enabled: true }] }),
			listModels: async () => ({ models: [ownershipModel] }),
			upsertProviderCredentials: async () => ({}),
			clearProviderCredentials: async () => ({}),
			previewHarnessProviderImport: async () => ({ items: [{ providerId: 'demo', label: 'Demo', source: 'fixture' }] }),
			importHarnessProviders: async () => ({ imported: 1, updated: 0, skipped: 0, modelWrites: 0, errors: [] }),
			upsertModel: async () => ({}),
			deleteModel: async () => ({}),
			setModelEnabled: async () => ({}),
			testModelProfile: async () => ({ ok: true }),
			...options,
		});
	}

	function clickAction(section: EngineProvidersSection | EngineModelsSection, label: string): void {
		const button = section.getDomNode().querySelector<HTMLElement>(`[aria-label="${label}"]`);
		assert.ok(button, `${label} action should exist`);
		button.click();
	}

	function invalidateWrite(kind: 'engine' | 'link' | 'dispose', connection: ReturnType<typeof createConnectionStub>, section: EngineProvidersSection | EngineModelsSection): void {
		if (kind === 'dispose') {
			section.dispose();
		} else {
			connection.setPublishedLink(kind === 'engine' ? 'engine-other' : 'engine-test', 2);
		}
	}

	for (const invalidation of ['engine', 'link', 'dispose'] as const) {
		for (const catalog of ['provider', 'model'] as const) {
			test(`write ownership: ${catalog} input cannot submit after ${invalidation}`, async () => {
				const input = new DeferredPromise<IInputResult>();
				let writes = 0;
				const connection = createWritableConnection({
					upsertProviderCredentials: async () => { writes++; return {}; },
					upsertModel: async () => { writes++; return {}; },
				});
				const dialog = new class extends TestDialogService {
					override input(): Promise<IInputResult> { return input.p; }
				}();
				const section = catalog === 'provider' ? mountProviders(connection, dialog) : mountModels(connection, dialog);
				await flushMicrotasks();
				clickAction(section, catalog === 'provider' ? 'Add provider' : 'Add model');
				invalidateWrite(invalidation, connection, section);
				await input.complete({ confirmed: true, values: catalog === 'provider' ? ['new', 'openai', '', 'fixture-secret'] : ['demo', 'new', 'general', '3'] });
				await flushMicrotasks();
				assert.strictEqual(writes, 0);
				assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent ?? '', '');
			});

			test(`write ownership: ${catalog} rename stops before deleting after ${invalidation}`, async () => {
				const write = new DeferredPromise<unknown>();
				let deletes = 0;
				let reads = 0;
				const connection = createWritableConnection({
					listProviderStatus: async () => { reads++; return { providers: [{ providerId: 'demo', brand: 'Demo', protocol: 'openai', configured: true, credentialSource: 'FILE', hasBaseUrl: true, enabled: true }] }; },
					listModels: async () => { reads++; return { models: [ownershipModel] }; },
					upsertProviderCredentials: () => write.p,
					upsertModel: () => write.p,
					clearProviderCredentials: async () => { deletes++; return {}; },
					deleteModel: async () => { deletes++; return {}; },
				});
				const dialog = new class extends TestDialogService {
					override async input(): Promise<IInputResult> {
						return { confirmed: true, values: catalog === 'provider' ? ['renamed', 'openai', '', 'fixture-secret'] : ['demo', 'renamed', 'general', '3'] };
					}
				}();
				const section = catalog === 'provider' ? mountProviders(connection, dialog) : mountModels(connection, dialog);
				await flushMicrotasks();
				clickAction(section, catalog === 'provider' ? 'Edit Demo' : 'Edit m');
				await flushMicrotasks();
				invalidateWrite(invalidation, connection, section);
				await flushMicrotasks();
				const readsAfterInvalidation = reads;
				await write.complete({});
				await flushMicrotasks();
				assert.deepStrictEqual({ deletes, lateReads: reads - readsAfterInvalidation, feedback: section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent ?? '' }, { deletes: 0, lateReads: 0, feedback: '' });
			});
		}

		for (const action of ['clear', 'delete', 'import'] as const) {
			test(`write ownership: ${action} confirmation cannot submit after ${invalidation}`, async () => {
				let writes = 0;
				const connection = createWritableConnection({
					clearProviderCredentials: async () => { writes++; return {}; },
					deleteModel: async () => { writes++; return {}; },
					importHarnessProviders: async () => { writes++; return {}; },
				});
				const section = action === 'delete' ? mountModels(connection) : mountProviders(connection);
				await flushMicrotasks();
				clickAction(section, action === 'clear' ? 'Clear Demo' : action === 'delete' ? 'Delete m' : 'Import from local harnesses');
				await flushMicrotasks();
				const confirm = document.querySelector<HTMLButtonElement>('.engine-confirm-popover-confirm');
				assert.ok(confirm);
				invalidateWrite(invalidation, connection, section);
				await flushMicrotasks();
				confirm.click();
				await flushMicrotasks();
				assert.strictEqual(writes, 0);
			});
		}
	}

	for (const resultKind of ['success', 'failure', 'rejection'] as const) {
		for (const action of ['provider', 'model-enabled', 'model-test'] as const) {
			test(`write ownership: ${action} late ${resultKind} cannot repaint or refresh another engine`, async () => {
				const result = new DeferredPromise<unknown>();
				let reads = 0;
				const connection = createWritableConnection({
					listProviderStatus: async () => { reads++; return { providers: [] }; },
					listModels: async () => { reads++; return { models: [ownershipModel] }; },
					upsertProviderCredentials: () => result.p,
					setModelEnabled: () => result.p,
					testModelProfile: () => result.p,
				});
				const dialog = new class extends TestDialogService {
					override async input(): Promise<IInputResult> { return { confirmed: true, values: ['demo', 'openai', '', 'fixture-secret'] }; }
				}();
				const section = action === 'provider' ? mountProviders(connection, dialog) : mountModels(connection);
				await flushMicrotasks();
				clickAction(section, action === 'provider' ? 'Add provider' : action === 'model-enabled' ? 'Disable m' : 'Test m');
				await flushMicrotasks();
				connection.setPublishedLink('engine-other', 2);
				await flushMicrotasks();
				const readsAfterSwitch = reads;
				if (resultKind === 'rejection') {
					await result.error(new Error('old fixture-secret failure'));
				} else {
					await result.complete({ ok: resultKind === 'success', message: 'old result' });
				}
				await flushMicrotasks();
				assert.deepStrictEqual({ lateReads: reads - readsAfterSwitch, feedback: section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent }, { lateReads: 0, feedback: '' });
			});
		}
	}

	test('write ownership: provider preview cannot open a new-engine confirmation', async () => {
		const preview = new DeferredPromise<{ items: readonly { providerId: string; label: string; source: string }[] }>();
		const connection = createWritableConnection({ previewHarnessProviderImport: () => preview.p });
		const section = mountProviders(connection);
		await flushMicrotasks();
		clickAction(section, 'Import from local harnesses');
		connection.setPublishedLink('engine-other', 2);
		await preview.complete({ items: [{ providerId: 'demo', label: 'Demo', source: 'fixture' }] });
		await flushMicrotasks();
		assert.strictEqual(document.querySelector('.engine-confirm-popover'), null);
	});

	test('write ownership: provider failures redact the submitted key', async () => {
		const connection = createWritableConnection({ upsertProviderCredentials: async () => { throw new Error('Rejected fixture-secret twice fixture-secret'); } });
		const dialog = new class extends TestDialogService {
			override async input(): Promise<IInputResult> { return { confirmed: true, values: ['demo', 'openai', '', 'fixture-secret'] }; }
		}();
		const section = mountProviders(connection, dialog);
		await flushMicrotasks();
		clickAction(section, 'Add provider');
		await flushMicrotasks();
		assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, 'Unable to save provider: Rejected [redacted] twice [redacted]');
		connection.setPublishedLink('engine-other', 2);
		await flushMicrotasks();
		assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
	});

	test('write ownership: completed model feedback belongs to its published link', async () => {
		const connection = createWritableConnection();
		const section = mountModels(connection);
		await flushMicrotasks();
		clickAction(section, 'Disable m');
		await flushMicrotasks();
		assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, 'Model disabled.');
		connection.setPublishedLink('engine-test', 2);
		await flushMicrotasks();
		assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
	});

	test('write ownership: missing published identity refuses a provider write', async () => {
		let writes = 0;
		const connection = createWritableConnection({ upsertProviderCredentials: async () => { writes++; return {}; } });
		const dialog = new class extends TestDialogService {
			override async input(): Promise<IInputResult> { return { confirmed: true, values: ['demo', 'openai', '', 'fixture-secret'] }; }
		}();
		const section = mountProviders(connection, dialog);
		await flushMicrotasks();
		connection.setPublishedLink(undefined, undefined, false);
		clickAction(section, 'Add provider');
		await flushMicrotasks();
		assert.strictEqual(writes, 0);
	});

	const expectedOwner: UniverseAgentExpectedOwner = { engineIdentityId: 'engine-test', linkId: 1 };
	const providerRow = { providerId: 'demo', brand: 'Demo', protocol: 'openai', configured: true, credentialSource: 'FILE', hasBaseUrl: true, enabled: true };
	const ownedActions = [
		{ name: 'provider add', catalog: 'provider', label: 'Add provider', values: ['new', 'openai', '', 'fixture-secret'], calls: ['upsertProviderCredentials', 'listProviderStatus'] },
		{ name: 'provider edit', catalog: 'provider', label: 'Edit Demo', values: ['demo', 'openai', '', 'fixture-secret'], calls: ['upsertProviderCredentials', 'listProviderStatus'] },
		{ name: 'provider rename', catalog: 'provider', label: 'Edit Demo', values: ['renamed', 'openai', '', 'fixture-secret'], calls: ['upsertProviderCredentials', 'clearProviderCredentials', 'listProviderStatus'] },
		{ name: 'provider clear', catalog: 'provider', label: 'Clear Demo', confirm: true, calls: ['clearProviderCredentials', 'listProviderStatus'] },
		{ name: 'provider import', catalog: 'provider', label: 'Import from local harnesses', confirm: true, calls: ['importHarnessProviders', 'listProviderStatus'] },
		{ name: 'model add', catalog: 'model', label: 'Add model', values: ['demo', 'new', 'general', '3'], calls: ['upsertModel', 'listModels'] },
		{ name: 'model edit', catalog: 'model', label: 'Edit m', values: ['demo', 'm', 'general', '3'], calls: ['upsertModel', 'listModels'] },
		{ name: 'model rename', catalog: 'model', label: 'Edit m', values: ['demo', 'renamed', 'general', '3'], calls: ['upsertModel', 'deleteModel', 'listModels'] },
		{ name: 'model toggle', catalog: 'model', label: 'Disable m', calls: ['setModelEnabled', 'listModels'] },
		{ name: 'model delete', catalog: 'model', label: 'Delete m', confirm: true, calls: ['deleteModel', 'listModels'] },
		{ name: 'model Test', catalog: 'model', label: 'Test m', calls: ['testModelProfile'] },
	] as const;

	function reconstructedCancellation(): Error {
		const error = new Error('Canceled');
		error.name = 'Canceled';
		assert.ok(isCancellationError(error));
		assert.ok(!(error instanceof CancellationError));
		return error;
	}

	async function assertNoCancellationLeak(run: () => Promise<void>): Promise<void> {
		const leaks: unknown[] = [];
		const onBrowserLeak = (event: PromiseRejectionEvent) => leaks.push(event.reason);
		const onProcessLeak = (reason: unknown) => leaks.push(reason);
		mainWindow.addEventListener('unhandledrejection', onBrowserLeak);
		process.on('unhandledRejection', onProcessLeak);
		try {
			await run();
			await flushMicrotasks();
			assert.deepStrictEqual(leaks, [], 'the UI must consume cancellation rather than relying on the runner filter');
		} finally {
			mainWindow.removeEventListener('unhandledrejection', onBrowserLeak);
			process.off('unhandledRejection', onProcessLeak);
		}
	}

	function createOwnerTraceConnection(cancel?: { readonly method: string; readonly error: Error }) {
		const trace: { method: string; owner: UniverseAgentExpectedOwner | undefined }[] = [];
		let previewCalls = 0;
		function record(method: string, owner: UniverseAgentExpectedOwner | undefined): void {
			trace.push({ method, owner: owner ? { ...owner } : undefined });
			if (cancel?.method === method) { throw cancel.error; }
		}
		const connection = createWritableConnection({
			listProviderStatus: async owner => { record('listProviderStatus', owner); return { providers: [providerRow] }; },
			listModels: async owner => { record('listModels', owner); return { models: [ownershipModel] }; },
			upsertProviderCredentials: async (request, owner) => { assert.ok(!Object.hasOwn(request, 'expectedOwner')); record('upsertProviderCredentials', owner); return {}; },
			clearProviderCredentials: async (_request, owner) => { record('clearProviderCredentials', owner); return {}; },
			previewHarnessProviderImport: async (...args: unknown[]) => { assert.strictEqual(args.length, 0); previewCalls++; return { items: [{ providerId: 'demo', label: 'Demo', source: 'fixture' }] }; },
			importHarnessProviders: async (_request, owner) => { record('importHarnessProviders', owner); return { imported: 1, updated: 0, skipped: 0, modelWrites: 0, errors: [] }; },
			upsertModel: async (request, owner) => { assert.ok(!Object.hasOwn(request, 'expectedOwner')); record('upsertModel', owner); return {}; },
			deleteModel: async (_request, owner) => { record('deleteModel', owner); return {}; },
			setModelEnabled: async (_request, owner) => { record('setModelEnabled', owner); return {}; },
			testModelProfile: async (_request, owner) => { record('testModelProfile', owner); return { ok: true }; },
		});
		return { connection, trace, get previewCalls() { return previewCalls; } };
	}

	async function beginOwnedAction(action: typeof ownedActions[number], connection: IUniverseAgentConnection) {
		const dialog = new class extends TestDialogService {
			override async input(): Promise<IInputResult> {
				return { confirmed: true, values: hasKey(action, { values: true }) ? [...action.values] : [] };
			}
		}();
		const section = action.catalog === 'provider' ? mountProviders(connection, dialog) : mountModels(connection, dialog);
		await flushMicrotasks();
		return { section, async submit() {
			clickAction(section, action.label);
			await flushMicrotasks();
			if (hasKey(action, { confirm: true })) {
				const confirm = document.querySelector<HTMLButtonElement>('.engine-confirm-popover-confirm');
				assert.ok(confirm);
				confirm.click();
				await flushMicrotasks();
			}
		} };
	}

	for (const action of ownedActions) {
		test(`expected owner: ${action.name} preserves action owner through every write and readback`, async () => {
			const fixture = createOwnerTraceConnection();
			const { section, submit } = await beginOwnedAction(action, fixture.connection);
			fixture.trace.length = 0;
			await submit();
			assert.deepStrictEqual(fixture.trace, action.calls.map(method => ({ method, owner: expectedOwner })));
			assert.ok(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent);
			assert.strictEqual(fixture.previewCalls, action.name === 'provider import' ? 1 : 0);
		});

		for (const cancellation of ['local', 'IPC reconstructed'] as const) {
			test(`expected owner: ${action.name} silently consumes ${cancellation} cancellation while renderer still caches A`, async () => {
				const error = cancellation === 'local' ? new CancellationError() : reconstructedCancellation();
				const fixture = createOwnerTraceConnection({ method: action.calls[0], error });
				const { section, submit } = await beginOwnedAction(action, fixture.connection);
				fixture.trace.length = 0;
				await assertNoCancellationLeak(submit);
				assert.deepStrictEqual(fixture.trace, [{ method: action.calls[0], owner: expectedOwner }]);
				assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
			});
		}
	}

	for (const action of ownedActions.filter(candidate => candidate.name !== 'model Test')) {
		test(`expected owner: ${action.name} waits for readback and silently discards its reconstructed cancellation`, async () => {
			const fixture = createOwnerTraceConnection();
			const { section, submit } = await beginOwnedAction(action, fixture.connection);
			const pending = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
			const readMethod = action.catalog === 'provider' ? 'listProviderStatus' : 'listModels';
			fixture.connection[readMethod] = owner => {
				fixture.trace.push({ method: readMethod, owner: owner ? { ...owner } : undefined });
				return pending.p;
			};
			fixture.trace.length = 0;
			await assertNoCancellationLeak(async () => {
				await submit();
				assert.deepStrictEqual(fixture.trace, action.calls.map(method => ({ method, owner: expectedOwner })));
				assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
				assert.strictEqual(section.getMode(), 'loading');
				const toolbar = section.getDomNode().querySelector<HTMLElement>('.engine-catalog-write-toolbar');
				assert.strictEqual(toolbar?.style.display, 'none');
				const callsBeforeSecondAction = fixture.trace.length;
				clickAction(section, action.catalog === 'provider' ? 'Add provider' : 'Add model');
				await flushMicrotasks();
				assert.strictEqual(fixture.trace.length, callsBeforeSecondAction, 'pending readback refuses a second write');
				await pending.error(reconstructedCancellation());
				await flushMicrotasks();
			});
			assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
			assert.notStrictEqual(section.getMode(), 'failed');
			assert.strictEqual(fixture.trace.length, action.calls.length, 'cancellation must not start another refresh');
		});
	}

	for (const catalog of ['provider', 'model'] as const) {
		test(`expected owner: ${catalog} current readback failure keeps original list and write feedback semantics`, async () => {
			const action = ownedActions.find(candidate => candidate.name === `${catalog} add`)!;
			const fixture = createOwnerTraceConnection();
			const { section, submit } = await beginOwnedAction(action, fixture.connection);
			const readMethod = catalog === 'provider' ? 'listProviderStatus' : 'listModels';
			fixture.connection[readMethod] = async owner => {
				fixture.trace.push({ method: readMethod, owner: owner ? { ...owner } : undefined });
				throw new Error('current list unavailable');
			};
			fixture.trace.length = 0;
			await submit();
			assert.deepStrictEqual(fixture.trace, action.calls.map(method => ({ method, owner: expectedOwner })));
			assert.strictEqual(section.getMode(), 'failed');
			assert.strictEqual(section.getListEntryCount(), 1, 'ordinary list failure keeps last-good rows');
			assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, catalog === 'provider' ? '' : 'Model saved.');
			assert.ok(section.getDomNode().textContent?.includes('current list unavailable'));
			assert.ok(!section.getDomNode().textContent?.includes('Unable to save'));
		});

		test(`expected owner: ${catalog} old readback cancellation cannot clear a newer owner result or block new writes`, async () => {
			const action = ownedActions.find(candidate => candidate.name === `${catalog} add`)!;
			const fixture = createOwnerTraceConnection();
			const { section, submit } = await beginOwnedAction(action, fixture.connection);
			const pending = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
			const readMethod = catalog === 'provider' ? 'listProviderStatus' : 'listModels';
			let readbacks = 0;
			fixture.connection[readMethod] = async owner => {
				fixture.trace.push({ method: readMethod, owner: owner ? { ...owner } : undefined });
				return ++readbacks === 1 ? pending.p : { models: [ownershipModel], providers: [providerRow] };
			};
			await assertNoCancellationLeak(async () => {
				await submit();
				fixture.connection.setPublishedLink('engine-other', 2);
				await flushMicrotasks();
				assert.strictEqual(section.getMode(), 'ready', 'new generation must not wait for old readback');
				fixture.trace.length = 0;
				await submit();
				assert.deepStrictEqual(fixture.trace, action.calls.map(method => ({ method, owner: { engineIdentityId: 'engine-other', linkId: 2 } })));
				const feedback = section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent;
				assert.ok(feedback);
				await pending.error(reconstructedCancellation());
				await flushMicrotasks();
				assert.strictEqual(section.getMode(), 'ready');
				assert.strictEqual(section.getListEntryCount(), 1);
				assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, feedback);
			});
		});
	}

	for (const catalog of ['provider', 'model'] as const) {
		test(`expected owner: ${catalog} rename second step cancellation cannot report success or read back`, async () => {
			const action = ownedActions.find(candidate => candidate.name === `${catalog} rename`)!;
			const fixture = createOwnerTraceConnection({ method: action.calls[1]!, error: reconstructedCancellation() });
			const { section, submit } = await beginOwnedAction(action, fixture.connection);
			fixture.trace.length = 0;
			await assertNoCancellationLeak(submit);
			assert.deepStrictEqual(fixture.trace, action.calls.slice(0, 2).map(method => ({ method, owner: expectedOwner })));
			assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
		});

		test(`expected owner: ordinary ${catalog} list captures owner while first load has no writable controls`, async () => {
			const owners: (UniverseAgentExpectedOwner | undefined)[] = [];
			const result = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
			const connection = createConnectionStub({
				providerSupport: 'SUPPORTED',
				listProviderStatus: owner => { owners.push(owner ? { ...owner } : undefined); return result.p; },
				listModels: owner => { owners.push(owner ? { ...owner } : undefined); return result.p; },
			});
			const section = catalog === 'provider' ? mountProviders(connection) : mountModels(connection);
			assert.strictEqual(section.getMode(), 'loading');
			assert.deepStrictEqual(owners, [expectedOwner]);
			await result.complete({ providers: [providerRow], models: [ownershipModel] });
			await flushMicrotasks();
			assert.strictEqual(section.getMode(), 'ready');
		});

		test(`expected owner: ordinary ${catalog} list rejects late results after an unnotified same-engine link change`, async () => {
			const result = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
			const connection = createConnectionStub({ providerSupport: 'SUPPORTED', listProviderStatus: () => result.p, listModels: () => result.p });
			const section = catalog === 'provider' ? mountProviders(connection) : mountModels(connection);
			connection.setPublishedLink('engine-test', 2, false);
			await result.complete({ providers: [providerRow], models: [ownershipModel] });
			await flushMicrotasks();
			assert.strictEqual(section.getListEntryCount(), 0);
			assert.ok(!section.getDomNode().textContent?.includes('Canceled'));
		});

		test(`expected owner: ordinary ${catalog} list silently consumes IPC reconstructed cancellation`, async () => {
			const connection = createConnectionStub({
				providerSupport: 'SUPPORTED',
				listProviderStatus: async () => { throw reconstructedCancellation(); },
				listModels: async () => { throw reconstructedCancellation(); },
			});
			let section: EngineProvidersSection | EngineModelsSection;
			await assertNoCancellationLeak(async () => {
				section = catalog === 'provider' ? mountProviders(connection) : mountModels(connection);
				await flushMicrotasks();
			});
			assert.strictEqual(section!.getListEntryCount(), 0);
			assert.notStrictEqual(section!.getMode(), 'failed');
			assert.ok(!section!.getDomNode().textContent?.includes('Canceled'));
		});
	}

	for (const catalog of ['provider', 'model'] as const) {
		test(`expected owner: ${catalog} write readback cannot apply a late result after an unnotified owner change`, async () => {
			const action = ownedActions.find(candidate => candidate.name === `${catalog} add`)!;
			const fixture = createOwnerTraceConnection();
			const { section, submit } = await beginOwnedAction(action, fixture.connection);
			const pending = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
			const readMethod = catalog === 'provider' ? 'listProviderStatus' : 'listModels';
			fixture.connection[readMethod] = () => pending.p;
			await submit();
			fixture.connection.setPublishedLink('engine-other', 2, false);
			await pending.complete({ providers: [{ ...providerRow, providerId: 'stale-result', brand: 'stale-result' }], models: [{ ...ownershipModel, id: 'stale-result', modelId: 'stale-result' }] });
			await flushMicrotasks();
			assert.ok(!section.getDomNode().textContent?.includes('stale-result'));
			assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-action-message')?.textContent, '');
		});
	}

	for (const catalog of ['provider', 'model'] as const) {
		test(`expected owner: ordinary ${catalog} list does not dispatch without a published owner`, async () => {
			let reads = 0;
			const connection = createConnectionStub({
				providerSupport: 'SUPPORTED',
				listProviderStatus: async () => { reads++; return { providers: [providerRow] }; },
				listModels: async () => { reads++; return { models: [ownershipModel] }; },
			});
			connection.setPublishedLink(undefined, undefined);
			const section = catalog === 'provider' ? mountProviders(connection) : mountModels(connection);
			await flushMicrotasks();
			assert.strictEqual(reads, 0);
			assert.strictEqual(section.getListEntryCount(), 0);
			assert.strictEqual(section.getMode(), 'disconnected');
		});
	}

	const catalogRowActions = [
		{ catalog: 'provider', label: 'Edit Demo', freshLabel: 'Edit Fresh', method: 'upsertProviderCredentials', confirm: false },
		{ catalog: 'provider', label: 'Clear Demo', freshLabel: 'Clear Fresh', method: 'clearProviderCredentials', confirm: true },
		{ catalog: 'model', label: 'Edit m', freshLabel: 'Edit m-fresh', method: 'upsertModel', confirm: false },
		{ catalog: 'model', label: 'Delete m', freshLabel: 'Delete m-fresh', method: 'deleteModel', confirm: true },
		{ catalog: 'model', label: 'Disable m', freshLabel: 'Disable m-fresh', method: 'setModelEnabled', confirm: false },
		{ catalog: 'model', label: 'Test m', freshLabel: 'Test m-fresh', method: 'testModelProfile', confirm: false },
	] as const;
	const freshProvider = { ...providerRow, providerId: 'fresh-provider', brand: 'Fresh' };
	const freshModel = { ...ownershipModel, id: 'fresh:m-fresh', provider: 'fresh', modelId: 'm-fresh' };

	async function createCatalogRowFixture(catalog: 'provider' | 'model') {
		const writes: { method: string; owner: UniverseAgentExpectedOwner | undefined; target: string }[] = [];
		let previewCalls = 0;
		function record(method: string, owner: UniverseAgentExpectedOwner | undefined, target: string) {
			writes.push({ method, owner: owner ? { ...owner } : undefined, target });
			return {};
		}
		const connection = createWritableConnection({
			upsertProviderCredentials: async (request, owner) => record('upsertProviderCredentials', owner, request.providerId),
			clearProviderCredentials: async (request, owner) => record('clearProviderCredentials', owner, request.providerId),
			upsertModel: async (request, owner) => record('upsertModel', owner, request.id),
			deleteModel: async (request, owner) => record('deleteModel', owner, request.id),
			setModelEnabled: async (request, owner) => record('setModelEnabled', owner, request.id),
			testModelProfile: async (request, owner) => { record('testModelProfile', owner, `${request.providerId}:${request.modelId}`); return { ok: true }; },
			previewHarnessProviderImport: async () => { previewCalls++; return { items: [{ providerId: 'fresh-provider', label: 'Fresh', source: 'fixture' }] }; },
			importHarnessProviders: async (request, owner) => { record('importHarnessProviders', owner, (request.providerIds ?? []).join(',')); return { imported: 1, updated: 0, skipped: 0, modelWrites: 0, errors: [] }; },
		});
		const dialog = new class extends TestDialogService {
			inputCalls = 0;
			override async input(input: IInput): Promise<IInputResult> {
				this.inputCalls++;
				const values = (input.inputs ?? []).map(field => field.value ?? '');
				values[0] ||= catalog === 'provider' ? 'fresh-added' : 'fresh';
				if (catalog === 'model') { values[1] ||= 'added-model'; }
				return { confirmed: true, values };
			}
		}();
		const section = catalog === 'provider' ? mountProviders(connection, dialog) : mountModels(connection, dialog);
		await flushMicrotasks();
		return { connection, section, dialog, writes, get previewCalls() { return previewCalls; } };
	}

	async function submitCatalogRow(section: EngineProvidersSection | EngineModelsSection, label: string, confirm: boolean): Promise<void> {
		clickAction(section, label);
		await flushMicrotasks();
		if (confirm) {
			const button = document.querySelector<HTMLButtonElement>('.engine-confirm-popover-confirm');
			assert.ok(button);
			button.click();
			await flushMicrotasks();
		}
	}

	for (const action of catalogRowActions) {
		for (const invalidation of ['engine', 'link'] as const) {
			test(`expected owner: ${action.label} cannot capture a new ${invalidation} from an old directory and recovers only after applying its new rows`, async () => {
				const fixture = await createCatalogRowFixture(action.catalog);
				const nextOwner = { engineIdentityId: invalidation === 'engine' ? 'engine-other' : 'engine-test', linkId: 2 };
				fixture.connection.setPublishedLink(nextOwner.engineIdentityId, nextOwner.linkId, false);
				clickAction(fixture.section, action.label);
				await flushMicrotasks();
				const unexpectedConfirm = document.querySelector('.engine-confirm-popover');
				if (unexpectedConfirm) {
					document.querySelector<HTMLButtonElement>('.engine-confirm-popover-cancel')?.click();
					await flushMicrotasks();
				}
				assert.deepStrictEqual([...fixture.writes], []);
				assert.strictEqual(fixture.dialog.inputCalls, 0, 'an old row must not open an editor bound to the new snapshot');
				assert.strictEqual(unexpectedConfirm, null, 'an old row must not open a confirmation bound to the new snapshot');
				fixture.connection.listProviderStatus = async () => ({ providers: [freshProvider] });
				fixture.connection.listModels = async () => ({ models: [freshModel] });
				fixture.connection.setPublishedLink(nextOwner.engineIdentityId, nextOwner.linkId);
				await flushMicrotasks();
				await submitCatalogRow(fixture.section, action.freshLabel, action.confirm);
				assert.deepStrictEqual(fixture.writes, [{ method: action.method, owner: nextOwner, target: action.catalog === 'provider' ? 'fresh-provider' : 'fresh:m-fresh' }]);
			});
		}
	}

	for (const catalog of ['provider', 'model'] as const) {
		for (const change of ['quiet owner', 'reentrant notification'] as const) {
			test(`expected owner: ${catalog} count observers cannot authorize old rows or toolbar during ${change} and the replacement directory restores all actions`, async () => {
				const fixture = await createCatalogRowFixture(catalog);
				const root = fixture.section.getDomNode();
				const oldRows = [...root.querySelectorAll<HTMLElement>(catalog === 'provider' ? '.engine-provider-status-list .engine-catalog-row-actions [aria-label]' : '.engine-models-list .engine-catalog-row-actions [aria-label]')];
				const oldToolbar = [...root.querySelectorAll<HTMLElement>('.engine-catalog-write-toolbar [aria-label]')];
				assert.strictEqual(oldRows.length, catalog === 'provider' ? 2 : 4);
				assert.strictEqual(oldToolbar.length, catalog === 'provider' ? 2 : 1);
				const second = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
				const third = new DeferredPromise<UniverseAgentListModelsResult & UniverseAgentListProviderStatusResult>();
				let pending = second.p;
				const readMethod = catalog === 'provider' ? 'listProviderStatus' : 'listModels';
				fixture.connection[readMethod] = () => pending;
				let observed = false;
				const duringCount: { rows: number; toolbar: string | undefined }[] = [];
				store.add(fixture.section.onDidChangeItemCount(() => {
					if (observed) { return; }
					observed = true;
					duringCount.push({ rows: root.querySelectorAll('.engine-catalog-row-actions').length, toolbar: root.querySelector<HTMLElement>('.engine-catalog-write-toolbar')?.style.display });
					pending = third.p;
					fixture.connection.setPublishedLink('engine-third', 3, false);
					for (const button of [...oldRows, ...oldToolbar]) { button.click(); }
					if (change === 'reentrant notification') { fixture.connection.setPublishedLink('engine-third', 3); }
				}));
				fixture.connection.setPublishedLink('engine-second', 2);
				await second.complete({ providers: [freshProvider, { ...freshProvider, providerId: 'extra-2', brand: 'Extra 2' }], models: [freshModel, { ...freshModel, id: 'fresh:extra-2', modelId: 'extra-2' }] });
				await flushMicrotasks();
				const unexpectedConfirm = document.querySelector('.engine-confirm-popover');
				if (unexpectedConfirm) {
					document.querySelector<HTMLButtonElement>('.engine-confirm-popover-cancel')?.click();
					await flushMicrotasks();
				}
				assert.deepStrictEqual(duringCount, [{ rows: 0, toolbar: 'none' }]);
				assert.deepStrictEqual([...fixture.writes], []);
				assert.strictEqual(fixture.dialog.inputCalls, 0);
				assert.strictEqual(fixture.previewCalls, 0);
				assert.strictEqual(unexpectedConfirm, null);
				assert.strictEqual(fixture.section.getMode(), 'loading');
				assert.strictEqual(root.querySelectorAll('.engine-catalog-row-actions').length, 0);
				if (change === 'quiet owner') { fixture.connection.setPublishedLink('engine-third', 3); }
				await third.complete({ providers: [freshProvider, { ...freshProvider, providerId: 'extra-2', brand: 'Extra 2' }, { ...freshProvider, providerId: 'extra-3', brand: 'Extra 3' }], models: [freshModel, { ...freshModel, id: 'fresh:extra-2', modelId: 'extra-2' }, { ...freshModel, id: 'fresh:extra-3', modelId: 'extra-3' }] });
				await flushMicrotasks();
				assert.strictEqual(fixture.section.getMode(), 'ready');
				assert.strictEqual(fixture.section.getListEntryCount(), 3);
				for (const action of catalogRowActions.filter(candidate => candidate.catalog === catalog)) {
					await submitCatalogRow(fixture.section, action.freshLabel, action.confirm);
				}
				await submitCatalogRow(fixture.section, catalog === 'provider' ? 'Add provider' : 'Add model', false);
				if (catalog === 'provider') { await submitCatalogRow(fixture.section, 'Import from local harnesses', true); }
				assert.deepStrictEqual(fixture.writes.map(write => write.method), catalog === 'provider'
					? ['upsertProviderCredentials', 'clearProviderCredentials', 'upsertProviderCredentials', 'importHarnessProviders']
					: ['upsertModel', 'deleteModel', 'setModelEnabled', 'testModelProfile', 'upsertModel']);
				assert.ok(fixture.writes.every(write => write.owner?.engineIdentityId === 'engine-third' && write.owner.linkId === 3));
			});
		}
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

	test('does not leak unhandled rejection when refreshProviders catch-path render throws and onUnexpectedError logs', async () => {
		// refreshProviders() already catches list throw; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path render throws.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
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
				unexpectedWarns: [paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when refreshModels catch-path render throws and onUnexpectedError logs', async () => {
		// refreshModels() already catches list throw; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path render throws.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
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
				unexpectedWarns: [paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('model enable failure after a mid-flight link change paints no action error', async () => {
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
			upsertModel: async () => ({ id: 'demo:m' }),
			deleteModel: async () => ({ deleted: true }),
			setModelEnabled: async () => {
				connection.setLinkId(2);
				throw new Error('enable boom');
			},
		});
		const section = mountModels(connection);
		await flushMicrotasks();

		const button = section.getDomNode().querySelector('[aria-label="Disable m"]') as HTMLElement;
		button.click();
		await flushMicrotasks();

		const actionMessage = section.getDomNode().querySelector('.engine-catalog-action-message') as HTMLElement;
		assert.strictEqual(actionMessage.textContent, '');
	});

	test('EngineProvidersSection: disposal detaches DOM container and clears nodes', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub({ providerSupport: 'SUPPORTED', listProviderStatus: async () => ({ providers: [] }) }));
		const section = instantiationService.createInstance(EngineProvidersSection, parent);
		assert.strictEqual(section.getDomNode().parentElement, parent);
		section.dispose();
		assert.strictEqual(section.getDomNode().parentElement, null);
		assert.strictEqual(section.getDomNode().childNodes.length, 0);
		parent.remove();
	});

	test('EngineModelsSection: disposal detaches DOM container and clears nodes', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub({ modelsSupport: 'SUPPORTED', listModels: async () => ({ models: [] }) }));
		const section = instantiationService.createInstance(EngineModelsSection, parent);
		assert.strictEqual(section.getDomNode().parentElement, parent);
		section.dispose();
		assert.strictEqual(section.getDomNode().parentElement, null);
		assert.strictEqual(section.getDomNode().childNodes.length, 0);
		parent.remove();
	});
});
