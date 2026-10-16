/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentAddMcpServerRequest,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListMcpServersRequest,
	UniverseAgentListMcpServersResult,
	UniverseAgentMcpServerSummary,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentUpdateMcpServerRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { EngineMcpSection } from '../../browser/engineMcpSection.js';
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

	function createSessionContextStub(overrides: Partial<IAgentSessionContext> = {}): IAgentSessionContext {
		return {
			_serviceBrand: undefined,
			getActiveSessionId: () => 'sess-1',
			isEngineSessionReady: () => true,
			isPairingHold: () => false,
			getActiveWorkRoot: () => ({ workDir: '' }),
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			acquireSessionView: () => ({ snapshot: {} as any, attribution: new Map(), dispose: () => { } }),
			...overrides,
		} as IAgentSessionContext;
	}

	function mountMcpSection(
		connection: IUniverseAgentConnection,
		sessionContext?: IAgentSessionContext,
	): EngineMcpSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IAgentSessionContext, sessionContext ?? createSessionContextStub());
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
			.find(button => button.textContent?.trim() === label) as HTMLButtonElement | undefined;
	}

	test('addServer with complete config succeeds', async () => {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
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
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
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

	test('sessionWorkDir locks to sessionContext.getActiveWorkRoot().workDir', async () => {
		const listRequests: UniverseAgentListMcpServersRequest[] = [];
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const removeRequests: UniverseAgentRemoveMcpServerRequest[] = [];
		const toggleRequests: UniverseAgentToggleMcpServerRequest[] = [];

		const server = demoMcpServer({ id: 'srv-1', name: 'Srv 1', command: 'echo' });
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
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
		const sessionContext = createSessionContextStub({
			getActiveWorkRoot: () => ({ workDir: '/repo/root' }),
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

	test('Clicking toolbar Add expands empty form without calling addMcpServer', async () => {
		let addCalls = 0;
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			addMcpServer: async () => {
				addCalls++;
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.isFormVisible(), false);
		const addButton = findToolbarButton(section.getDomNode(), 'Add');
		assert.ok(addButton);
		addButton.click();
		await flushMicrotasks();

		assert.strictEqual(section.isFormVisible(), true);
		assert.strictEqual(section.getFormMode(), 'add');
		assert.deepStrictEqual(section.getFormValues(), {
			name: '',
			transport: 'stdio',
			command: '',
			url: '',
		});
		assert.strictEqual(addCalls, 0);
	});

	test('Form submit with stdio and empty command does not call addMcpServer', async () => {
		let addCalls = 0;
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			addMcpServer: async () => {
				addCalls++;
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		const addButton = findToolbarButton(section.getDomNode(), 'Add');
		assert.ok(addButton);
		addButton.click();

		section.setFormValues({ name: 'test-mcp', transport: 'stdio', command: '   ' });
		const submitted = await section.submitFormForTest();
		assert.strictEqual(submitted, false);
		assert.strictEqual(addCalls, 0);
		assert.strictEqual(section.isFormVisible(), true);
	});

	test('Form submit with valid name and command calls addMcpServer once and closes form', async () => {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			addMcpServer: async request => {
				addRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		const addButton = findToolbarButton(section.getDomNode(), 'Add');
		assert.ok(addButton);
		addButton.click();

		section.setFormValues({ name: 'my-server', transport: 'stdio', command: 'node index.js' });
		const submitted = await section.submitFormForTest();
		assert.strictEqual(submitted, true);
		assert.strictEqual(addRequests.length, 1);
		assert.strictEqual(addRequests[0].config.name, 'my-server');
		assert.strictEqual(addRequests[0].config.transport, 'stdio');
		assert.strictEqual(addRequests[0].config.command, 'node index.js');
		assert.strictEqual(addRequests[0].scope, 'global');
		assert.strictEqual(section.isFormVisible(), false);
	});

	test('Form submit with sse/streamable_http validates url', async () => {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			addMcpServer: async request => {
				addRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		const addButton = findToolbarButton(section.getDomNode(), 'Add');
		assert.ok(addButton);
		addButton.click();

		section.setFormValues({ name: 'sse-server', transport: 'sse', url: '   ' });
		assert.strictEqual(await section.submitFormForTest(), false);
		assert.strictEqual(addRequests.length, 0);

		section.setFormValues({ url: 'https://example.com/sse' });
		assert.strictEqual(await section.submitFormForTest(), true);
		assert.strictEqual(addRequests.length, 1);
		assert.strictEqual(addRequests[0].config.name, 'sse-server');
		assert.strictEqual(addRequests[0].config.transport, 'sse');
		assert.strictEqual(addRequests[0].config.url, 'https://example.com/sse');
		assert.strictEqual(section.isFormVisible(), false);
	});

	test('Clicking toolbar Update with no selection does not open form and does not call updateMcpServer', async () => {
		let updateCalls = 0;
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			updateMcpServer: async () => {
				updateCalls++;
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		const updateButton = findToolbarButton(section.getDomNode(), 'Update');
		assert.ok(updateButton);
		updateButton.click();
		await flushMicrotasks();

		assert.strictEqual(section.isFormVisible(), false);
		assert.strictEqual(updateCalls, 0);
	});

	test('Clicking toolbar Update with selection pre-fills form fields', async () => {
		const server = demoMcpServer({
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio',
			command: 'npx',
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [server] }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		const updateButton = findToolbarButton(section.getDomNode(), 'Update');
		assert.ok(updateButton);
		updateButton.click();
		await flushMicrotasks();

		assert.strictEqual(section.isFormVisible(), true);
		assert.strictEqual(section.getFormMode(), 'update');
		assert.strictEqual(section.getFormValues().name, 'Demo MCP');
		assert.strictEqual(section.getFormValues().transport, 'stdio');
		assert.strictEqual(section.getFormValues().command, 'npx');
	});

	test('Submitting unchanged form values does not call updateMcpServer', async () => {
		let updateCalls = 0;
		const server = demoMcpServer({
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio',
			command: 'npx',
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [server] }),
			updateMcpServer: async () => {
				updateCalls++;
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		const updateButton = findToolbarButton(section.getDomNode(), 'Update');
		assert.ok(updateButton);
		updateButton.click();

		const submitted = await section.submitFormForTest();
		assert.strictEqual(submitted, false);
		assert.strictEqual(updateCalls, 0);
		assert.strictEqual(section.isFormVisible(), true);
	});

	test('Submitting modified name calls updateMcpServer once preserving other fields', async () => {
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const server = demoMcpServer({
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio',
			command: 'npx',
			args: ['-y', 'mcp-demo'],
			env: { TOKEN: 'secret' },
			url: undefined,
			enabled: true,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [server] }),
			updateMcpServer: async request => {
				updateRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		const updateButton = findToolbarButton(section.getDomNode(), 'Update');
		assert.ok(updateButton);
		updateButton.click();

		section.setFormValues({ name: 'Renamed MCP' });
		const submitted = await section.submitFormForTest();
		assert.strictEqual(submitted, true);
		assert.strictEqual(updateRequests.length, 1);
		assert.strictEqual(updateRequests[0].serverId, 'stdio-demo');
		assert.strictEqual(updateRequests[0].config.name, 'Renamed MCP');
		assert.strictEqual(updateRequests[0].config.transport, 'stdio');
		assert.strictEqual(updateRequests[0].config.command, 'npx');
		assert.deepStrictEqual(updateRequests[0].config.args, ['-y', 'mcp-demo']);
		assert.deepStrictEqual(updateRequests[0].config.env, { TOKEN: 'secret' });
		assert.strictEqual(updateRequests[0].config.enabled, true);
		assert.strictEqual(section.isFormVisible(), false);
	});

	test('Update form with unknown transport requires changing to valid transport', async () => {
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const server = demoMcpServer({
			id: 'unknown-demo',
			name: 'Unknown MCP',
			transport: 'unknown' as any,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [server] }),
			updateMcpServer: async request => {
				updateRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectServerByIdForTest('unknown-demo'), true);
		const updateButton = findToolbarButton(section.getDomNode(), 'Update');
		assert.ok(updateButton);
		updateButton.click();

		assert.strictEqual(section.getFormValues().transport, 'unknown');
		assert.strictEqual(await section.submitFormForTest(), false);
		assert.strictEqual(updateRequests.length, 0);

		section.setFormValues({ name: 'Changed Name' });
		assert.strictEqual(await section.submitFormForTest(), false);
		assert.strictEqual(updateRequests.length, 0);

		section.setFormValues({ transport: 'stdio', command: 'my-cmd' });
		assert.strictEqual(await section.submitFormForTest(), true);
		assert.strictEqual(updateRequests.length, 1);
		assert.strictEqual(updateRequests[0].config.name, 'Changed Name');
		assert.strictEqual(updateRequests[0].config.transport, 'stdio');
		assert.strictEqual(updateRequests[0].config.command, 'my-cmd');
	});

	test('Form cancel button closes form and resets form mode', async () => {
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		const addButton = findToolbarButton(section.getDomNode(), 'Add');
		assert.ok(addButton);
		addButton.click();
		assert.strictEqual(section.isFormVisible(), true);

		const cancelButton = section.getDomNode().querySelector('.engine-mcp-form-cancel') as HTMLElement | null;
		assert.ok(cancelButton);
		cancelButton.click();
		assert.strictEqual(section.isFormVisible(), false);
		assert.strictEqual(section.getFormMode(), undefined);
	});

	test('Active work root change automatically triggers refresh and passes new workDir', async () => {
		const listRequests: UniverseAgentListMcpServersRequest[] = [];
		let currentWorkDir = '/workspace/dir-a';

		const onDidChangeActiveSession = store.add(new Emitter<string>());
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());

		const sessionContext = createSessionContextStub({
			getActiveWorkRoot: () => ({ workDir: currentWorkDir }),
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		});

		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => ({
				...createEmptyTestCapabilitySnapshot(),
				mcp: { support: 'SUPPORTED' },
			}),
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
		onDidChangeActiveSession.fire('sess-2');
		await flushMicrotasks();

		assert.strictEqual(listRequests.length >= 2, true);
		assert.strictEqual(listRequests[listRequests.length - 1].workDir, '/workspace/dir-b');

		currentWorkDir = '/workspace/dir-c';
		onDidChangeActiveWorkRoot.fire({ workDir: '/workspace/dir-c' });
		await flushMicrotasks();

		assert.strictEqual(listRequests.length >= 3, true);
		assert.strictEqual(listRequests[listRequests.length - 1].workDir, '/workspace/dir-c');
	});
});
