/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createCatalogSessionContext, createCatalogWorkRoot } from '../common/engineCatalogTestFixtures.js';
import { IDialogService, IInput, IInputResult } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { BrowserDialogHandler } from '../../../../browser/parts/dialogs/dialogHandler.js';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentAddMcpServerRequest,
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListMcpServersRequest,
	UniverseAgentMcpServerSummary,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentUpdateMcpServerRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ENGINE_MCP_ADD_SUCCESS_COPY, ENGINE_MCP_REMOVE_SUCCESS_COPY, EngineMcpSection } from '../../browser/engineMcpSection.js';
import { engineWriteNotSentCopy, engineWriteSelectionNotSentCopy, engineWriteUnconfirmedCopy } from '../../browser/engineWriteGate.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('EngineMcpSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function demoMcpServer(overrides: Partial<UniverseAgentMcpServerSummary> = {}): UniverseAgentMcpServerSummary {
		return {
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio',
			origin: 'global',
			enabled: true,
			command: 'npx',
			args: ['-y', 'mcp-demo'],
			env: { TOKEN: 'secret' },
			url: undefined,
			...overrides,
		};
	}

	function mountMcpSection(
		connection: IUniverseAgentConnection,
		sessionContext?: IAgentSessionContext,
		dialog?: TestDialogService,
	): EngineMcpSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IAgentSessionContext, sessionContext ?? createCatalogSessionContext());
		if (dialog) {
			instantiationService.stub(IDialogService, dialog);
		}
		const section = store.add(instantiationService.createInstance(EngineMcpSection, parent));
		section.setSectionActive(true);
		section.layout(640, 200);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await timeout(0);
	}

	function findToolbarButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-catalog-write-toolbar .monaco-button')]
			.find(button => button.getAttribute('aria-label') === label || button.getAttribute('aria-label') === `${label}. Select a server first.`) as HTMLButtonElement | undefined;
	}

	function publishedSnapshot(capabilities: UniverseAgentCapabilitySnapshot, connected = true): UniverseAgentConnectionSnapshot {
		return {
			transport: connected ? 'ok' : 'idle',
			authenticated: connected,
			pairingPending: false,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
			engineIdentityId: connected ? 'test-engine' : undefined,
			linkId: connected ? 1 : undefined,
		};
	}

	test('addServer with complete config succeeds', async () => {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			addMcpServer: async request => {
				addRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		const result = await section.addServer({ name: 'added', transport: 'stdio', command: 'echo' });
		assert.strictEqual(result, true);
		assert.strictEqual(addRequests.length, 1);
		assert.strictEqual(addRequests[0].config.name, 'added');
		assert.strictEqual(addRequests[0].config.transport, 'stdio');
		assert.strictEqual(addRequests[0].config.command, 'echo');
		assert.strictEqual(addRequests[0].scope, 'global');
	});

	test('updateSelectedServer with partial config succeeds', async () => {
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const server = demoMcpServer({ id: 'srv-1', name: 'Srv 1', command: 'echo' });
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [server] }),
			updateMcpServer: async request => {
				updateRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectServerByIdForTest('srv-1'), true);
		const result = await section.updateSelectedServer({ name: 'Srv 2' });
		assert.strictEqual(result, true);
		assert.strictEqual(updateRequests.length, 1);
		assert.strictEqual(updateRequests[0].serverId, 'srv-1');
		assert.strictEqual(updateRequests[0].config.name, 'Srv 2');
		assert.strictEqual(updateRequests[0].config.command, 'echo');
	});

	test('late add response after link replacement does not paint success', async () => {
		let linkId = 1;
		let resolveAdd!: (value: { ok: true }) => void;
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcp: { support: 'SUPPORTED' as const },
		};
		const emitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				authenticated: true,
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities,
				engineIdentityId: 'test-engine',
				linkId,
			}),
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: emitter.event,
			listMcpServers: async () => ({ servers: [] }),
			addMcpServer: () => new Promise<{ ok: true }>(resolve => { resolveAdd = resolve; }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		const write = section.addServer({ name: 'late', transport: 'stdio', command: 'echo' });
		linkId = 2;
		resolveAdd({ ok: true });
		assert.strictEqual(await write, false);
		const status = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.strictEqual(status.textContent, engineWriteUnconfirmedCopy());
		assert.notStrictEqual(status.textContent, ENGINE_MCP_ADD_SUCCESS_COPY);
		emitter.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();
		assert.strictEqual(status.textContent, engineWriteUnconfirmedCopy());
		assert.notStrictEqual(status.textContent, ENGINE_MCP_ADD_SUCCESS_COPY);
	});

	test('add stays disabled while the add RPC is in flight', async () => {
		let resolveAdd!: (value: { ok: true }) => void;
		let adds = 0;
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [] }),
			addMcpServer: () => {
				adds++;
				return new Promise<{ ok: true }>(resolve => { resolveAdd = resolve; });
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		const button = findToolbarButton(section.getDomNode(), 'Add') as HTMLButtonElement;
		assert.strictEqual(button.getAttribute('aria-disabled'), 'false');
		const write = section.addServer({ name: 'late', transport: 'stdio', command: 'echo' });
		await flushMicrotasks();
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(await section.addServer({ name: 'other', transport: 'stdio', command: 'echo' }), false);
		assert.strictEqual(adds, 1);
		resolveAdd({ ok: true });
		assert.strictEqual(await write, true);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'false');
	});

	test('remove keeps the success copy after the selection is cleared', async () => {
		const server = demoMcpServer({ id: 'srv-1', name: 'Srv 1' });
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [server] }),
			removeMcpServer: async () => ({ ok: true }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		assert.strictEqual(section.selectServerByIdForTest('srv-1'), true);
		assert.strictEqual(await section.removeSelectedServer(), true);
		assert.strictEqual(section.getSelectedServerId(), undefined);
		const status = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.strictEqual(status.textContent, ENGINE_MCP_REMOVE_SUCCESS_COPY);
		assert.notStrictEqual(status.style.display, 'none');
	});

	test('a link change before add does not call addMcpServer', async () => {
		let linkId = 1;
		const adds: UniverseAgentAddMcpServerRequest[] = [];
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities, true),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [] }),
			addMcpServer: async request => {
				adds.push(request);
				return { ok: true };
			},
		});
		const snapshot = connection.getConnectionSnapshot.bind(connection);
		connection.getConnectionSnapshot = () => ({ ...snapshot(), linkId });
		const dialog = new ControlledInputDialog();
		const section = mountMcpSection(connection, undefined, dialog);
		await flushMicrotasks();
		findToolbarButton(section.getDomNode(), 'Add')!.click();
		await flushMicrotasks();
		linkId = 2;
		dialog.complete({ confirmed: true, values: ['named', 'stdio', 'echo', '', '', ''] });
		await flushMicrotasks();
		assert.strictEqual(adds.length, 0);
		assert.ok((section.getDomNode().textContent ?? '').includes(engineWriteNotSentCopy()));
	});

	test('changing the selected server before update does not call updateMcpServer', async () => {
		const first = demoMcpServer({ id: 'srv-1', name: 'Srv 1', command: 'echo' });
		const second = demoMcpServer({ id: 'srv-2', name: 'Srv 2', command: 'echo' });
		const updates: UniverseAgentUpdateMcpServerRequest[] = [];
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [first, second] }),
			updateMcpServer: async request => {
				updates.push(request);
				return { ok: true };
			},
		});
		const dialog = new ControlledInputDialog();
		const section = mountMcpSection(connection, undefined, dialog);
		await flushMicrotasks();
		assert.strictEqual(section.selectServerByIdForTest('srv-1'), true);
		findToolbarButton(section.getDomNode(), 'Update')!.click();
		await flushMicrotasks();
		assert.strictEqual(section.selectServerByIdForTest('srv-2'), true);
		dialog.complete({ confirmed: true, values: ['Srv 1', 'stdio', 'echo-new', '', '', ''] });
		await flushMicrotasks();
		assert.strictEqual(updates.length, 0);
		assert.ok((section.getDomNode().textContent ?? '').includes(engineWriteSelectionNotSentCopy()));
	});

	test('add still lands when a connection event refreshes during the dialog', async () => {
		const emitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let lists = 0;
		let releaseStaleList: (() => void) | undefined;
		const adds: UniverseAgentAddMcpServerRequest[] = [];
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: emitter.event,
			listMcpServers: () => {
				lists++;
				if (lists === 1 || lists >= 3) {
					return Promise.resolve({ servers: [] });
				}
				return new Promise(resolve => { releaseStaleList = () => resolve({ servers: [] }); });
			},
			addMcpServer: async request => {
				adds.push(request);
				return { ok: true };
			},
		});
		const dialog = new ControlledInputDialog();
		const section = mountMcpSection(connection, undefined, dialog);
		await flushMicrotasks();
		findToolbarButton(section.getDomNode(), 'Add')!.click();
		await flushMicrotasks();
		emitter.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();
		assert.strictEqual(adds.length, 0);
		dialog.complete({ confirmed: true, values: ['named', 'stdio', 'echo', '', '', ''] });
		await flushMicrotasks();
		assert.strictEqual(adds.length, 1);
		assert.ok((section.getDomNode().textContent ?? '').includes(ENGINE_MCP_ADD_SUCCESS_COPY));
		releaseStaleList?.();
		await flushMicrotasks();
		assert.ok((section.getDomNode().textContent ?? '').includes(ENGINE_MCP_ADD_SUCCESS_COPY));
	});

	test('add still shows success when the link id leaves and returns', async () => {
		let linkId = 1;
		let resolveAdd!: (value: { ok: true }) => void;
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ ...publishedSnapshot(capabilities), linkId }),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [] }),
			addMcpServer: () => new Promise<{ ok: true }>(resolve => { resolveAdd = resolve; }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		const write = section.addServer({ name: 'round', transport: 'stdio', command: 'echo' });
		linkId = 2;
		linkId = 1;
		resolveAdd({ ok: true });
		assert.strictEqual(await write, true);
		assert.ok((section.getDomNode().textContent ?? '').includes(ENGINE_MCP_ADD_SUCCESS_COPY));
	});

	test('a failed add after the link changes shows unconfirmed, not the engine error', async () => {
		let linkId = 1;
		let resolveAdd!: (value: { ok: false; reason: string }) => void;
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ ...publishedSnapshot(capabilities), linkId }),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [] }),
			addMcpServer: () => new Promise<{ ok: false; reason: string }>(resolve => { resolveAdd = resolve; }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		const write = section.addServer({ name: 'late', transport: 'stdio', command: 'echo' });
		linkId = 2;
		resolveAdd({ ok: false, reason: 'disk full' });
		assert.strictEqual(await write, false);
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes(engineWriteUnconfirmedCopy()));
		assert.ok(!text.includes('disk full'));
	});

	test('dispose during add stays silent', async () => {
		let resolveAdd!: (value: { ok: true }) => void;
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [] }),
			addMcpServer: () => new Promise<{ ok: true }>(resolve => { resolveAdd = resolve; }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		const write = section.addServer({ name: 'late', transport: 'stdio', command: 'echo' });
		section.dispose();
		resolveAdd({ ok: true });
		assert.strictEqual(await write, false);
		const text = section.getDomNode().textContent ?? '';
		assert.ok(!text.includes(ENGINE_MCP_ADD_SUCCESS_COPY));
		assert.ok(!text.includes(engineWriteUnconfirmedCopy()));
	});

	test('sessionWorkDir locks to sessionContext.getActiveWorkRoot().workDir', async () => {
		const listRequests: UniverseAgentListMcpServersRequest[] = [];
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const removeRequests: UniverseAgentRemoveMcpServerRequest[] = [];
		const toggleRequests: UniverseAgentToggleMcpServerRequest[] = [];

		const server = demoMcpServer({ id: 'srv-1', name: 'Srv 1', command: 'echo' });
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async (request = {}) => {
				listRequests.push(request);
				return { servers: [server] };
			},
			addMcpServer: async request => {
				addRequests.push(request);
				return { ok: true };
			},
			updateMcpServer: async request => {
				updateRequests.push(request);
				return { ok: true };
			},
			removeMcpServer: async request => {
				removeRequests.push(request);
				return { ok: true };
			},
			toggleMcpServer: async request => {
				toggleRequests.push(request);
				return { ok: true };
			},
		});
		const sessionContext = createCatalogSessionContext({
			getActiveWorkRoot: () => createCatalogWorkRoot('/repo/root'),
		});

		const section = mountMcpSection(connection, sessionContext);
		await flushMicrotasks();

		assert.strictEqual(listRequests.length >= 1, true);
		assert.strictEqual(listRequests[0].workDir, '/repo/root');

		await section.addServer({ name: 'added', transport: 'stdio', command: 'echo' });
		assert.strictEqual(addRequests.length, 1);
		assert.strictEqual(addRequests[0].workDir, '/repo/root');

		assert.strictEqual(section.selectServerByIdForTest('srv-1'), true);
		await section.updateSelectedServer({ name: 'Srv 2' });
		assert.strictEqual(updateRequests.length, 1);
		assert.strictEqual(updateRequests[0].workDir, '/repo/root');

		await section.toggleServerForTest('srv-1', false);
		assert.strictEqual(toggleRequests.length, 1);
		assert.strictEqual(toggleRequests[0].workDir, '/repo/root');

		await section.removeSelectedServer();
		assert.strictEqual(removeRequests.length, 1);
		assert.strictEqual(removeRequests[0].workDir, '/repo/root');
	});

	class ControlledInputDialog extends TestDialogService {
		readonly requests: IInput[] = [];
		private resolveInput: ((result: IInputResult) => void) | undefined;

		override input(input: IInput): Promise<IInputResult> {
			assert.strictEqual(this.resolveInput, undefined, 'one active input dialog');
			this.requests.push(input);
			return new Promise(resolve => { this.resolveInput = resolve; });
		}

		complete(result: IInputResult): void {
			const resolve = this.resolveInput;
			assert.ok(resolve, 'toolbar opened the shared input dialog');
			this.resolveInput = undefined;
			resolve(result);
		}
	}

	function createDialogHarness(server = demoMcpServer()) {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		let connected = true;
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			getConnectionPhase: () => connected ? { kind: 'connected', path: 'loopback' } : { kind: 'disconnected' },
			getConnectionSnapshot: () => publishedSnapshot(capabilities, connected),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async () => ({ servers: [server, demoMcpServer({ id: 'other', name: 'Other' })] }),
			addMcpServer: async request => { addRequests.push(request); return { ok: true }; },
			updateMcpServer: async request => { updateRequests.push(request); return { ok: true }; },
		});
		const dialog = new ControlledInputDialog();
		const section = mountMcpSection(connection, undefined, dialog);
		return {
			section, dialog, addRequests, updateRequests,
			disconnect: () => { connected = false; },
			open: (label: 'Add' | 'Update') => {
				const button = findToolbarButton(section.getDomNode(), label);
				assert.ok(button);
				button.click();
			},
		};
	}

	test('Clicking toolbar Add opens empty shared input without calling addMcpServer', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		h.open('Add');
		assert.strictEqual(h.dialog.requests.length, 1);
		assert.strictEqual(h.dialog.requests[0].message, 'Add MCP server');
		assert.deepStrictEqual(h.dialog.requests[0].inputs.map(input => ({ label: input.label, value: input.value ?? '' })), [
			{ label: 'Name', value: '' }, { label: 'Transport', value: '' },
			{ label: 'Command', value: '' }, { label: 'URL', value: '' },
			{ label: 'Arguments — one argument per line', value: '' }, { label: 'Environment — one KEY=VALUE per line', value: '' },
		]);
		assert.strictEqual(h.addRequests.length, 0);
		h.dialog.complete({ confirmed: false });
		await flushMicrotasks();
	});

	test('Shared input validates stdio empty command and defensive confirmation does not add', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		h.open('Add');
		const values = ['test-mcp', 'stdio', '   ', ''];
		assert.strictEqual(h.dialog.requests[0].validate?.(values), 'Name, transport, and a command or URL are required.');
		h.dialog.complete({ confirmed: true, values });
		await flushMicrotasks();
		assert.strictEqual(h.addRequests.length, 0);
	});

	test('Shared input with valid name and command calls addMcpServer once', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		h.open('Add');
		const values = [' my-server ', 'stdio', ' node index.js ', ''];
		assert.strictEqual(h.dialog.requests[0].validate?.(values), undefined);
		h.dialog.complete({ confirmed: true, values });
		await flushMicrotasks();
		assert.deepStrictEqual(h.addRequests, [{ config: { name: 'my-server', transport: 'stdio', command: 'node index.js' }, scope: 'global' }]);
	});

	for (const transport of ['sse', 'streamable_http'] as const) {
		test(`Shared input validates ${transport} URL before adding`, async () => {
			const h = createDialogHarness();
			await flushMicrotasks();
			h.open('Add');
			assert.strictEqual(h.dialog.requests[0].validate?.(['remote', transport, '', '   ']), 'Name, transport, and a command or URL are required.');
			h.dialog.complete({ confirmed: true, values: ['remote', transport, '', '   '] });
			await flushMicrotasks();
			assert.strictEqual(h.addRequests.length, 0);
			h.open('Add');
			const values = ['remote', transport, '', ' https://example.com/mcp '];
			assert.strictEqual(h.dialog.requests[1].validate?.(values), undefined);
			h.dialog.complete({ confirmed: true, values });
			await flushMicrotasks();
			assert.strictEqual(h.addRequests.length, 1);
			assert.deepStrictEqual(h.addRequests[0].config, { name: 'remote', transport, url: 'https://example.com/mcp' });
		});
	}

	test('Clicking toolbar Update without selection does not open input or write', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		const update = findToolbarButton(h.section.getDomNode(), 'Update');
		assert.ok(update);
		assert.strictEqual(update.getAttribute('aria-label'), 'Update. Select a server first.');
		assert.strictEqual(update.getAttribute('aria-disabled'), 'true');
		h.open('Update');
		assert.deepStrictEqual({ dialogs: h.dialog.requests.length, writes: h.updateRequests.length }, { dialogs: 0, writes: 0 });
	});

	test('Clicking toolbar Update with selection pre-fills all shared input fields', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		assert.ok(h.section.selectServerByIdForTest('stdio-demo'));
		h.open('Update');
		assert.strictEqual(h.dialog.requests[0].message, 'Edit MCP server');
		assert.deepStrictEqual(h.dialog.requests[0].inputs.map(input => input.value), ['Demo MCP', 'stdio', 'npx', '', '-y\nmcp-demo', 'TOKEN=secret']);
		h.dialog.complete({ confirmed: false });
		await flushMicrotasks();
	});

	test('Submitting unchanged shared input does not call updateMcpServer', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		assert.ok(h.section.selectServerByIdForTest('stdio-demo'));
		h.open('Update');
		h.dialog.complete({ confirmed: true, values: [' Demo MCP ', 'stdio', ' npx ', '', '', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.updateRequests.length, 0);
	});

	test('Submitting modified name updates once preserving hidden and blank fields', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		assert.ok(h.section.selectServerByIdForTest('stdio-demo'));
		h.open('Update');
		h.dialog.complete({ confirmed: true, values: ['Renamed MCP', 'stdio', 'npx', '', '', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.updateRequests.length, 1);
		assert.strictEqual(h.updateRequests[0].serverId, 'stdio-demo');
		assert.deepStrictEqual(h.updateRequests[0].config, {
			id: 'stdio-demo', name: 'Renamed MCP', transport: 'stdio', command: 'npx', args: ['-y', 'mcp-demo'],
			env: { TOKEN: 'secret' }, url: undefined, enabled: true,
		});
	});

	test('Unknown transport pre-fills empty and requires an explicit valid transport', async () => {
		const h = createDialogHarness(demoMcpServer({ transport: 'unknown' }));
		await flushMicrotasks();
		assert.ok(h.section.selectServerByIdForTest('stdio-demo'));
		h.open('Update');
		assert.strictEqual(h.dialog.requests[0].inputs[1].value, '');
		assert.strictEqual(h.dialog.requests[0].validate?.(['Changed Name', '', 'npx', '']), 'Transport must be stdio, sse, or streamable_http.');
		h.dialog.complete({ confirmed: true, values: ['Changed Name', '', 'npx', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.updateRequests.length, 0);
		h.open('Update');
		h.dialog.complete({ confirmed: true, values: ['Changed Name', 'stdio', 'my-cmd', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.updateRequests.length, 1);
		assert.deepStrictEqual({ name: h.updateRequests[0].config.name, transport: h.updateRequests[0].config.transport, command: h.updateRequests[0].config.command }, { name: 'Changed Name', transport: 'stdio', command: 'my-cmd' });
	});

	test('Cancelling shared input does not write and a new Add starts empty', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		h.open('Add');
		h.dialog.complete({ confirmed: false, values: ['Discard', 'stdio', 'npx', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.addRequests.length, 0);
		h.open('Add');
		assert.deepStrictEqual(h.dialog.requests[1].inputs.map(input => input.value ?? ''), ['', '', '', '', '', '']);
		h.dialog.complete({ confirmed: false });
		await flushMicrotasks();
	});

	test('Shared input rejects missing names and malformed environment before RPC', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		for (const values of [
			['', 'stdio', 'npx', '', '', ''],
			['Added', 'stdio', 'npx', '', '', 'TOKEN'],
			['Added', 'stdio', 'npx', '', '', '=value'],
		]) {
			h.open('Add');
			const input = h.dialog.requests[h.dialog.requests.length - 1];
			assert.ok(input.validate?.(values));
			h.dialog.complete({ confirmed: true, values });
			await flushMicrotasks();
			assert.strictEqual(h.addRequests.length, 0);
		}
	});

	test('Shared input sends arguments and environment and editing arguments alone writes', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		h.open('Add');
		h.dialog.complete({ confirmed: true, values: ['Added', 'stdio', 'npx', '', '-y\nnew-package', 'TOKEN=new-secret'] });
		await flushMicrotasks();
		assert.strictEqual(h.addRequests.length, 1);
		assert.deepStrictEqual(h.addRequests[0].config, { name: 'Added', transport: 'stdio', command: 'npx', args: ['-y', 'new-package'], env: { TOKEN: 'new-secret' } });
		assert.ok(h.section.selectServerByIdForTest('stdio-demo'));
		h.open('Update');
		h.dialog.complete({ confirmed: true, values: ['Demo MCP', 'stdio', 'npx', '', '-y\nchanged-package', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.updateRequests.length, 1);
		assert.deepStrictEqual(h.updateRequests[0].config.args, ['-y', 'changed-package']);
		assert.deepStrictEqual(h.updateRequests[0].config.env, { TOKEN: 'secret' });
	});

	test('Shared browser dialog keeps invalid input open, closes accepted input, and cancels without writing', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		const layout = new TestLayoutService();
		layout.activeContainer = host;
		instantiationService.stub(ILayoutService, layout);
		const handler = instantiationService.createInstance(BrowserDialogHandler);
		const cancellation = new CancellationTokenSource();
		store.add({ dispose: () => cancellation.dispose(true) });
		const dialog = new class extends TestDialogService {
			override input(input: IInput): Promise<IInputResult> {
				return handler.input({ ...input, token: cancellation.token });
			}
		};
		const requests: UniverseAgentAddMcpServerRequest[] = [];
		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			addMcpServer: async request => { requests.push(request); return { ok: true }; },
		});
		const section = mountMcpSection(connection, undefined, dialog);
		await flushMicrotasks();
		const add = findToolbarButton(section.getDomNode(), 'Add');
		assert.ok(add);
		const clickDialogButton = (label: string) => {
			const button = [...host.querySelectorAll<HTMLElement>('.dialog-buttons .monaco-button')]
				.find(button => button.textContent?.trim() === label);
			assert.ok(button, `${label} is visible in the shared dialog`);
			button.click();
		};
		add.click();
		await flushMicrotasks();
		const inputs = [...host.querySelectorAll<HTMLInputElement>('.dialog-message-container input')];
		assert.strictEqual(inputs.length, 6);
		inputs[0].value = 'Real dialog';
		inputs[1].value = 'stdio';
		clickDialogButton('Add');
		await flushMicrotasks();
		assert.ok(host.querySelector('.monaco-dialog-box'));
		assert.strictEqual(host.querySelector('[role="alert"]')?.textContent, 'Name, transport, and a command or URL are required.');
		assert.strictEqual(requests.length, 0);
		inputs[2].value = 'npx';
		clickDialogButton('Add');
		await flushMicrotasks();
		assert.strictEqual(host.querySelector('.monaco-dialog-box'), null);
		assert.strictEqual(requests.length, 1);
		assert.deepStrictEqual(requests[0].config, { name: 'Real dialog', transport: 'stdio', command: 'npx' });
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual([...host.querySelectorAll<HTMLInputElement>('.dialog-message-container input')].map(input => input.value), ['', '', '', '', '', '']);
		clickDialogButton('Cancel');
		await flushMicrotasks();
		assert.strictEqual(host.querySelector('.monaco-dialog-box'), null);
		assert.strictEqual(requests.length, 1);
	});

	test('Confirmation after disconnect does not add', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		h.open('Add');
		h.disconnect();
		h.dialog.complete({ confirmed: true, values: ['Late', 'stdio', 'npx', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.addRequests.length, 0);
	});

	test('Confirmation after selected server changes does not update either server', async () => {
		const h = createDialogHarness();
		await flushMicrotasks();
		assert.ok(h.section.selectServerByIdForTest('stdio-demo'));
		h.open('Update');
		assert.ok(h.section.selectServerByIdForTest('other'));
		h.dialog.complete({ confirmed: true, values: ['Late', 'stdio', 'npx', ''] });
		await flushMicrotasks();
		assert.strictEqual(h.updateRequests.length, 0);
	});

	test('Active work root change automatically triggers refresh and passes new workDir', async () => {
		const listRequests: UniverseAgentListMcpServersRequest[] = [];
		let currentWorkDir = '/workspace/dir-a';
		let currentSessionId = 'sess-1';

		const onDidChangeActiveSession = store.add(new Emitter<string>());
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());

		const sessionContext = createCatalogSessionContext({
			getActiveSessionId: () => currentSessionId,
			getActiveWorkRoot: () => createCatalogWorkRoot(currentWorkDir, currentSessionId),
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		});

		const capabilities = { ...createEmptyTestCapabilitySnapshot(), mcp: { support: 'SUPPORTED' as const } };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedSnapshot(capabilities),
			getCapabilitySnapshot: () => capabilities,
			listMcpServers: async (request = {}) => {
				listRequests.push(request);
				return { servers: [demoMcpServer()] };
			},
		});

		mountMcpSection(connection, sessionContext);
		await flushMicrotasks();

		assert.strictEqual(listRequests.length, 1);
		assert.strictEqual(listRequests[0].workDir, '/workspace/dir-a');

		currentWorkDir = '/workspace/dir-b';
		currentSessionId = 'sess-2';
		onDidChangeActiveSession.fire('sess-2');
		await flushMicrotasks();

		assert.strictEqual(listRequests.length >= 2, true);
		assert.strictEqual(listRequests[listRequests.length - 1].workDir, '/workspace/dir-b');

		currentWorkDir = '/workspace/dir-c';
		onDidChangeActiveWorkRoot.fire(createCatalogWorkRoot('/workspace/dir-c', currentSessionId));
		await flushMicrotasks();

		assert.strictEqual(listRequests.length >= 3, true);
		assert.strictEqual(listRequests[listRequests.length - 1].workDir, '/workspace/dir-c');
	});
});
