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
	UniverseAgentListPluginsResult,
	UniverseAgentPluginSummary,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy, getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
import {
	ENGINE_PLUGINS_ENABLE_SUCCESS_COPY,
	ENGINE_PLUGINS_RELOAD_SUCCESS_COPY,
	ENGINE_PLUGINS_UNLOAD_SUCCESS_COPY,
	EnginePluginsSection,
	formatEnginePluginsScanEmptyCopy,
	formatEnginePluginsScanFoundCopy,
} from '../../browser/enginePluginsSection.js';
import { localize } from '../../../../../nls.js';

const PLUGINS_FEATURE = localize('ua.enginePluginsFeatureLabel', "engine plugins");
const PLUGINS_EMPTY_COPY = localize('ua.enginePluginsEmpty', "No engine plugins.");
const PLUGIN_INFO_FEATURE = localize('ua.enginePluginInfoFeature', "plugin info");
const PLUGIN_HOOKS_EMPTY_COPY = localize('ua.enginePluginHooksEmpty', "No hooks.");
const LEFTOVER_HOOK_CLASS = 'LeftoverHook';

suite('EnginePluginsSection write-success (D155 / D216)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function demoPlugin(): UniverseAgentPluginSummary {
		return {
			id: 'demo-plugin',
			displayName: 'Demo Plugin',
			version: '1.0.0',
			source: 'jar',
			hookCount: 1,
			status: 'disabled',
		};
	}

	function createConnectionStub(options: {
		connected?: boolean;
		pluginsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listPlugins?: () => Promise<UniverseAgentListPluginsResult>;
		enablePlugin?: IUniverseAgentConnection['enablePlugin'];
		reloadPlugin?: IUniverseAgentConnection['reloadPlugin'];
		unloadPlugin?: IUniverseAgentConnection['unloadPlugin'];
		scanNewPlugins?: IUniverseAgentConnection['scanNewPlugins'];
		getPluginInfo?: IUniverseAgentConnection['getPluginInfo'];
	} = {}): IUniverseAgentConnection & {
		setPluginsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setConnected(next: boolean): void;
		clearGetPluginInfo(): void;
	} {
		const pluginsCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN' } = {
			support: options.pluginsSupport ?? 'SUPPORTED',
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			plugins: pluginsCapability,
		};
		let connected = options.connected ?? true;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		const plugin = demoPlugin();
		let getPluginInfo: IUniverseAgentConnection['getPluginInfo'] | undefined = 'getPluginInfo' in options
			? options.getPluginInfo
			: (async () => ({ summary: plugin, hooks: [] }));

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
			listPlugins: options.listPlugins ?? (async () => ({ plugins: [plugin] })),
			get getPluginInfo() {
				return getPluginInfo as IUniverseAgentConnection['getPluginInfo'];
			},
			enablePlugin: options.enablePlugin ?? (async () => ({ plugin })),
			reloadPlugin: options.reloadPlugin ?? (async () => ({ plugin })),
			unloadPlugin: options.unloadPlugin ?? (async () => ({ removedHookCount: 0 })),
			scanNewPlugins: options.scanNewPlugins ?? (async () => ({ newPlugins: [], skippedCount: 0 })),
			toggleMcpServer: async () => ({ ok: true }),
			addMcpServer: async () => ({ ok: true }),
			updateMcpServer: async () => ({ ok: true }),
			removeMcpServer: async () => ({ ok: true }),
			listTools: async () => ({ tools: [] }),
			listModels: async () => ({ models: [] }),
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setPluginsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				pluginsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setConnected(next: boolean) {
				connected = next;
				onDidChangeConnection.fire(snapshot());
			},
			clearGetPluginInfo() {
				getPluginInfo = undefined;
			},
		};
	}

	function mountSection(connection: IUniverseAgentConnection): EnginePluginsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EnginePluginsSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function assertPluginsLeftoverFailedHonesty(section: EnginePluginsSection, errorMessage: string, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(PLUGINS_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGINS_EMPTY_COPY));
	}

	function assertScanSuccessClearedAfterListFail(section: EnginePluginsSection, successCopy: string, listReason: string): void {
		assertPluginsLeftoverFailedHonesty(section, listReason, 1);
		assert.ok(section.selectPluginForTest('demo-plugin'));
		const scanResult = section.getDomNode().querySelector('.engine-plugins-scan-result') as HTMLElement;
		assert.ok(scanResult);
		assert.notStrictEqual(scanResult.textContent, successCopy);
		assert.ok(!(scanResult.textContent ?? '').includes(successCopy));
		assert.ok(scanResult.style.display === 'none' || !(scanResult.textContent ?? '').trim());

		const catalog = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(catalog);
		assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
		assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(PLUGINS_FEATURE, listReason)));
	}

	function assertWriteSuccessClearedAfterListFail(section: EnginePluginsSection, successCopy: string, listReason: string): void {
		assertPluginsLeftoverFailedHonesty(section, listReason, 1);
		assert.ok(section.selectPluginForTest('demo-plugin'));
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.textContent, successCopy);
		assert.ok(!(writeStatus.textContent ?? '').includes(successCopy));

		const catalog = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(catalog);
		assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
		assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(PLUGINS_FEATURE, listReason)));
	}

	function getHooksTable(section: EnginePluginsSection): HTMLTableElement | null {
		return section.getDomNode().querySelector('table.engine-plugins-hooks-table');
	}

	function assertPluginInfoFailedHonesty(section: EnginePluginsSection, reason: string, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getHookRowCount(), expectedRows);
		assert.strictEqual(section.getHookEntries().length, expectedRows);
		const infoStatus = [...section.getDomNode().querySelectorAll('.engine-catalog-status-widget')].find(
			el => (el.textContent ?? '').includes(getCatalogFailedCopy(PLUGIN_INFO_FEATURE, reason)),
		) as HTMLElement | undefined;
		assert.ok(infoStatus);
		assert.strictEqual(infoStatus.dataset['catalogMode'], 'failed');
		const hooksTable = getHooksTable(section);
		assert.ok(hooksTable);
		if (expectedRows === 0) {
			assert.strictEqual(hooksTable.style.display, 'none');
		} else {
			assert.notStrictEqual(hooksTable.style.display, 'none');
			assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));
		}
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGIN_HOOKS_EMPTY_COPY));
	}

	function assertPluginInfoUnavailableHonesty(section: EnginePluginsSection, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getHookRowCount(), expectedRows);
		assert.strictEqual(section.getHookEntries().length, expectedRows);
		const infoStatus = [...section.getDomNode().querySelectorAll('.engine-catalog-status-widget')].find(
			el => (el.textContent ?? '').includes(getCatalogUnsupportedCopy(PLUGIN_INFO_FEATURE)),
		) as HTMLElement | undefined;
		assert.ok(infoStatus);
		assert.strictEqual(infoStatus.dataset['catalogMode'], 'unsupported');
		const hooksTable = getHooksTable(section);
		assert.ok(hooksTable);
		if (expectedRows === 0) {
			assert.strictEqual(hooksTable.style.display, 'none');
		} else {
			assert.notStrictEqual(hooksTable.style.display, 'none');
			assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));
		}
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGIN_HOOKS_EMPTY_COPY));
	}

	test('successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listPluginsCalls = 0;
		const leftover = { ...demoPlugin(), id: 'leftover-plugin', displayName: 'Leftover Plugin' };
		const connection = createConnectionStub({
			listPlugins: async () => {
				listPluginsCalls++;
				return { plugins: [leftover] };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		const listCallsAfterLoad = listPluginsCalls;

		connection.setPluginsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		assert.strictEqual(listPluginsCalls, listCallsAfterLoad);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGINS_EMPTY_COPY));
	});

	test('first-pull capability UNKNOWN is empty with capability loading and no leftover rows', async () => {
		let listPluginsCalls = 0;
		const connection = createConnectionStub({
			pluginsSupport: 'UNKNOWN',
			listPlugins: async () => {
				listPluginsCalls++;
				return { plugins: [demoPlugin()] };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.selectPluginForTest('demo-plugin'), false);
		assert.strictEqual(listPluginsCalls, 0);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.strictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGINS_EMPTY_COPY));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Demo Plugin'));
	});

	test('listPlugins first-pull throw is failed with no leftover rows', async () => {
		const connection = createConnectionStub({
			listPlugins: async () => {
				throw new Error('listPlugins exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.selectPluginForTest('demo-plugin'), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(PLUGINS_FEATURE, 'listPlugins exploded')));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGINS_EMPTY_COPY));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Demo Plugin'));
	});

	test('listPlugins success then throw keeps leftover rows and paints failed', async () => {
		let listPluginsCalls = 0;
		const leftover = { ...demoPlugin(), id: 'leftover-plugin', displayName: 'Leftover Plugin' };
		const connection = createConnectionStub({
			listPlugins: async () => {
				listPluginsCalls++;
				if (listPluginsCalls === 1) {
					return { plugins: [leftover] };
				}
				throw new Error('listPlugins retry exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		assert.strictEqual(listPluginsCalls, 1);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGINS_EMPTY_COPY));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listPluginsCalls, 2);
		assertPluginsLeftoverFailedHonesty(section, 'listPlugins retry exploded', 1);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
	});

	test('enablePlugin ok does not keep Enabled. when subsequent listPlugins fails', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					if (listPluginsCalls > 1) {
						throw new Error('list boom');
					}
					return { plugins: [demoPlugin()] };
				},
				enablePlugin: async () => ({ plugin: demoPlugin() }),
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.selectPluginForTest('demo-plugin'), true);

			await section.enableSelectedForTest();
			assert.ok(listPluginsCalls >= 2);
			assertWriteSuccessClearedAfterListFail(section, ENGINE_PLUGINS_ENABLE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('unloadPlugin ok does not keep Unloaded. when subsequent listPlugins fails', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					if (listPluginsCalls > 1) {
						throw new Error('list boom');
					}
					return { plugins: [demoPlugin()] };
				},
				unloadPlugin: async () => ({ removedHookCount: 1 }),
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.selectPluginForTest('demo-plugin'), true);

			await section.unloadSelectedForTest();
			assert.ok(listPluginsCalls >= 2);
			assertWriteSuccessClearedAfterListFail(section, ENGINE_PLUGINS_UNLOAD_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('reloadPlugin ok does not keep Reloaded. when subsequent listPlugins fails', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					if (listPluginsCalls > 1) {
						throw new Error('list boom');
					}
					return { plugins: [demoPlugin()] };
				},
				reloadPlugin: async () => ({ plugin: demoPlugin() }),
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.selectPluginForTest('demo-plugin'), true);

			await section.reloadSelectedForTest();
			assert.ok(listPluginsCalls >= 2);
			assertWriteSuccessClearedAfterListFail(section, ENGINE_PLUGINS_RELOAD_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('enablePlugin throw shows write-failure status and keeps catalog rows', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					return { plugins: [demoPlugin()] };
				},
				enablePlugin: async () => {
					throw new Error('enable exploded');
				},
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.selectPluginForTest('demo-plugin'), true);

			await section.enableSelectedForTest();
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			assert.strictEqual(section.canWrite(), true);
			assert.strictEqual(listPluginsCalls, 1);

			const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
			assert.ok(status);
			assert.notStrictEqual(status.style.display, 'none');
			assert.strictEqual(status.dataset['catalogMode'], 'failed');
			assert.ok(status.textContent?.includes(getCatalogFailedCopy(PLUGINS_FEATURE, 'enable exploded')));
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('scanNewPlugins empty ok does not keep scan-success when subsequent listPlugins fails', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					if (listPluginsCalls > 1) {
						throw new Error('list boom');
					}
					return { plugins: [demoPlugin()] };
				},
				scanNewPlugins: async () => ({ newPlugins: [], skippedCount: 3 }),
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');

			await section.scanNewForTest();
			assert.ok(listPluginsCalls >= 2);
			assertScanSuccessClearedAfterListFail(section, formatEnginePluginsScanEmptyCopy(3), 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('scanNewPlugins found ok does not keep scan-success when subsequent listPlugins fails', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const found = { ...demoPlugin(), id: 'fresh-plugin', displayName: 'Fresh Plugin' };
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					if (listPluginsCalls > 1) {
						throw new Error('list boom');
					}
					return { plugins: [demoPlugin()] };
				},
				scanNewPlugins: async () => ({ newPlugins: [found], skippedCount: 1 }),
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');

			await section.scanNewForTest();
			assert.ok(listPluginsCalls >= 2);
			assertScanSuccessClearedAfterListFail(section, formatEnginePluginsScanFoundCopy('Fresh Plugin', 1), 'list boom');
			assert.ok(!(section.getDomNode().textContent ?? '').includes('Fresh Plugin'));
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('scanNewPlugins ok keeps scan-success when subsequent listPlugins succeeds', async () => {
		let listPluginsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				listPlugins: async () => {
					listPluginsCalls++;
					return { plugins: [demoPlugin()] };
				},
				scanNewPlugins: async () => ({ newPlugins: [], skippedCount: 2 }),
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listPluginsCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');

			await section.scanNewForTest();
			assert.ok(listPluginsCalls >= 2);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			const scanResult = section.getDomNode().querySelector('.engine-plugins-scan-result') as HTMLElement;
			assert.ok(scanResult);
			assert.strictEqual(scanResult.textContent, formatEnginePluginsScanEmptyCopy(2));
			assert.notStrictEqual(scanResult.style.display, 'none');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	function leftoverHook(): { hookType: string; priority: number; className: string } {
		return { hookType: 'onChat', priority: 10, className: LEFTOVER_HOOK_CLASS };
	}

	function leftoverPlugin(): UniverseAgentPluginSummary {
		return { ...demoPlugin(), id: 'leftover-plugin', displayName: 'Leftover Plugin' };
	}

	function assertLeftoverHooksKeptAfterCatalogHonesty(section: EnginePluginsSection, expectedRows: number): void {
		assert.strictEqual(section.getHookRowCount(), expectedRows);
		assert.strictEqual(section.getHookEntries().length, expectedRows);
		const hooksTable = getHooksTable(section);
		assert.ok(hooksTable);
		assert.notStrictEqual(hooksTable.style.display, 'none');
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGIN_HOOKS_EMPTY_COPY));
	}

	test('successful hooks then list throw then select leftover keeps hook rows', async () => {
		let listPluginsCalls = 0;
		let infoCalls = 0;
		const leftover = leftoverPlugin();
		const connection = createConnectionStub({
			listPlugins: async () => {
				listPluginsCalls++;
				if (listPluginsCalls === 1) {
					return { plugins: [leftover] };
				}
				throw new Error('listPlugins retry exploded');
			},
			getPluginInfo: async () => {
				infoCalls++;
				return { summary: leftover, hooks: [leftoverHook()] };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertLeftoverHooksKeptAfterCatalogHonesty(section, 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listPluginsCalls, 2);
		assertPluginsLeftoverFailedHonesty(section, 'listPlugins retry exploded', 1);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertPluginsLeftoverFailedHonesty(section, 'listPlugins retry exploded', 1);
		assertLeftoverHooksKeptAfterCatalogHonesty(section, 1);
	});

	test('successful hooks then capability UNKNOWN then select leftover keeps hook rows', async () => {
		let listPluginsCalls = 0;
		let infoCalls = 0;
		const leftover = leftoverPlugin();
		const connection = createConnectionStub({
			listPlugins: async () => {
				listPluginsCalls++;
				return { plugins: [leftover] };
			},
			getPluginInfo: async () => {
				infoCalls++;
				return { summary: leftover, hooks: [leftoverHook()] };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertLeftoverHooksKeptAfterCatalogHonesty(section, 1);
		const listCallsAfterLoad = listPluginsCalls;

		connection.setPluginsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(listPluginsCalls, listCallsAfterLoad);
		assert.ok(section.selectPluginForTest('leftover-plugin'));
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 1);
		assertLeftoverHooksKeptAfterCatalogHonesty(section, 1);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGINS_EMPTY_COPY));
	});

	test('getPluginInfo first-pull throw is failed with no leftover hook rows', async () => {
		const connection = createConnectionStub({
			getPluginInfo: async () => {
				throw new Error('getPluginInfo exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok(section.selectPluginForTest('demo-plugin'));
		await flushMicrotasks();

		assertPluginInfoFailedHonesty(section, 'getPluginInfo exploded', 0);
	});

	test('getPluginInfo success then throw keeps leftover hook rows and paints failed', async () => {
		let infoCalls = 0;
		const leftoverHook = { hookType: 'onChat', priority: 10, className: LEFTOVER_HOOK_CLASS };
		const connection = createConnectionStub({
			getPluginInfo: async () => {
				infoCalls++;
				if (infoCalls === 1) {
					return { summary: demoPlugin(), hooks: [leftoverHook] };
				}
				throw new Error('getPluginInfo retry exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.selectPluginForTest('demo-plugin'));
		await flushMicrotasks();

		const hooksTable = getHooksTable(section);
		assert.ok(hooksTable);
		assert.strictEqual(section.getHookRowCount(), 1);
		assert.strictEqual(section.getHookEntries().length, 1);
		assert.notStrictEqual(hooksTable.style.display, 'none');
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGIN_HOOKS_EMPTY_COPY));
		assert.strictEqual(infoCalls, 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 2);
		assertPluginInfoFailedHonesty(section, 'getPluginInfo retry exploded', 1);
	});

	test('getPluginInfo reconnect reload in-flight keeps leftover hook rows', async () => {
		let infoCalls = 0;
		let releaseSecond: (() => void) | undefined;
		const leftoverHook = { hookType: 'onChat', priority: 10, className: LEFTOVER_HOOK_CLASS };
		const connection = createConnectionStub({
			getPluginInfo: async () => {
				infoCalls++;
				if (infoCalls === 1) {
					return { summary: demoPlugin(), hooks: [leftoverHook] };
				}
				await new Promise<void>(resolve => {
					releaseSecond = resolve;
				});
				return { summary: demoPlugin(), hooks: [leftoverHook] };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.selectPluginForTest('demo-plugin'));
		await flushMicrotasks();

		const hooksTable = getHooksTable(section);
		assert.ok(hooksTable);
		assert.strictEqual(section.getHookRowCount(), 1);
		assert.notStrictEqual(hooksTable.style.display, 'none');
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 2);
		assert.ok(releaseSecond);
		assert.strictEqual(section.getHookRowCount(), 1);
		assert.notStrictEqual(hooksTable.style.display, 'none');
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(PLUGIN_HOOKS_EMPTY_COPY));
		const loadingStatus = [...section.getDomNode().querySelectorAll('.engine-catalog-status-widget')].find(
			el => el instanceof HTMLElement && el.dataset['catalogMode'] === 'loading',
		) as HTMLElement | undefined;
		assert.ok(loadingStatus);
		assert.ok((loadingStatus.textContent ?? '').includes(getCatalogListLoadingCopy()));

		releaseSecond!();
		await flushMicrotasks();
		assert.strictEqual(section.getHookRowCount(), 1);
		assert.notStrictEqual(hooksTable.style.display, 'none');
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));
	});

	test('getPluginInfo first-pull missing hook is unavailable with no leftover hook rows', async () => {
		const connection = createConnectionStub({
			getPluginInfo: undefined,
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok(section.selectPluginForTest('demo-plugin'));
		await flushMicrotasks();

		assertPluginInfoUnavailableHonesty(section, 0);
	});

	test('getPluginInfo live paint then missing hook keeps leftover hook rows and paints unavailable', async () => {
		const leftoverHook = { hookType: 'onChat', priority: 10, className: LEFTOVER_HOOK_CLASS };
		const connection = createConnectionStub({
			getPluginInfo: async () => ({ summary: demoPlugin(), hooks: [leftoverHook] }),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.selectPluginForTest('demo-plugin'));
		await flushMicrotasks();

		const hooksTable = getHooksTable(section);
		assert.ok(hooksTable);
		assert.strictEqual(section.getHookRowCount(), 1);
		assert.notStrictEqual(hooksTable.style.display, 'none');
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_HOOK_CLASS));

		connection.clearGetPluginInfo();
		connection.setConnected(true);
		await flushMicrotasks();

		assertPluginInfoUnavailableHonesty(section, 1);
	});
});
