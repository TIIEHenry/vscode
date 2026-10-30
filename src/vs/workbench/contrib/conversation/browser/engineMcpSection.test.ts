/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IDialogService, type IInput } from '../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../platform/dialogs/test/common/testDialogService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import type {
	UniverseAgentAddMcpServerRequest,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListMcpServersResult,
	UniverseAgentMcpServerSummary,
	UniverseAgentUpdateMcpServerRequest,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { ENGINE_MCP_UPDATE_SUCCESS_COPY, EngineMcpSection } from './engineMcpSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineMcpSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listMcpServers after dispose does not paint MCP definition rows', async () => {
		let releaseList: ((value: UniverseAgentListMcpServersResult) => void) | undefined;
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcp: { support: 'SUPPORTED' as const },
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities,
			engineIdentityId: 'test-engine',
			linkId: 1,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			listMcpServers: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineMcpSection, parent);
		section.setSectionActive(true);
		section.layout(640, 160);
		await timeout(0);

		section.dispose();
		releaseList?.({
			servers: [{
				id: 'late-after-dispose-mcp',
				name: 'late-after-dispose-mcp',
				transport: 'stdio',
				origin: 'global',
				enabled: true,
			}],
		});
		await timeout(0);

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-catalog-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('late-after-dispose-mcp'));
	});

	test('MCP list and writes carry the active session work directory', async () => {
		const workDir = '/session/work';
		const requests: { workDir?: string }[] = [];
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcp: { support: 'SUPPORTED' as const },
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities,
			engineIdentityId: 'test-engine',
			linkId: 1,
		});
		const server = {
			id: 'srv',
			name: 'Srv',
			transport: 'stdio' as const,
			origin: 'project' as const,
			enabled: true,
			command: 'echo',
		};
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			listMcpServers: async request => {
				requests.push(request ?? {});
				return { servers: [server] };
			},
			addMcpServer: async request => {
				requests.push(request);
				return { ok: true, assignedId: 'added' };
			},
			updateMcpServer: async request => {
				requests.push(request);
				return { ok: true };
			},
			removeMcpServer: async request => {
				requests.push(request);
				return { ok: true };
			},
			toggleMcpServer: async request => {
				requests.push(request);
				return { ok: true };
			},
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IAgentSessionContext, {
			getActiveWorkRoot: () => ({
				sessionId: 'sess-1',
				engineIdentityId: 'eng',
				workDir,
				source: 'session',
				access: 'engine',
				localRoot: undefined,
				projectKey: 'eng\n/session/work',
			}),
		} as IAgentSessionContext);
		const section = store.add(instantiationService.createInstance(EngineMcpSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		await timeout(0);

		assert.ok(requests.length >= 1);
		assert.strictEqual(requests[0]?.workDir, workDir);
		assert.strictEqual(section.selectServerByIdForTest('srv'), true);
		assert.strictEqual(await section.updateSelectedServer({ name: 'Srv 2' }), true);
		await section.toggleServerForTest('srv', false);
		assert.strictEqual(await section.removeSelectedServer(), true);
		assert.strictEqual(await section.addServer({ name: 'added', transport: 'stdio', command: 'echo' }), true);
		assert.ok(requests.length >= 5);
		assert.ok(requests.every(request => request.workDir === workDir));
	});

	const envInvalidCopy = 'Environment lines must be KEY=VALUE.';
	const dialogDetail = 'stdio uses the command. sse and streamable_http use the URL. Arguments are one per line. Environment is one KEY=VALUE per line.';

	function stdioServer(): UniverseAgentMcpServerSummary {
		return {
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio',
			origin: 'global',
			enabled: false,
			command: 'npx',
			args: ['-y', 'mcp-demo'],
			env: { TOKEN: 'secret' },
			url: 'http://mcp',
		};
	}

	function assertMcpDialogShape(input: IInput): void {
		assert.strictEqual(input.inputs.length, 6);
		assert.strictEqual(input.inputs[4]?.label, 'Arguments — one argument per line');
		assert.strictEqual(input.inputs[4]?.placeholder, input.inputs[4]?.label);
		assert.strictEqual(input.inputs[5]?.label, 'Environment — one KEY=VALUE per line');
		assert.strictEqual(input.inputs[5]?.placeholder, input.inputs[5]?.label);
		assert.strictEqual(input.detail, dialogDetail);
	}

	function stubMcpDialog(dialog: TestDialogService, values: readonly string[], check?: (input: IInput) => void): void {
		dialog.input = (async (input?: IInput) => {
			if (check) {
				if (!input) {
					throw new Error('dialog input was not passed');
				}
				check(input);
			}
			return { confirmed: true, values: [...values] };
		}) as TestDialogService['input'];
	}

	async function mountReadyMcp(): Promise<{
		section: EngineMcpSection;
		dialog: TestDialogService;
		addRequests: UniverseAgentAddMcpServerRequest[];
		updateRequests: UniverseAgentUpdateMcpServerRequest[];
	}> {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const updateRequests: UniverseAgentUpdateMcpServerRequest[] = [];
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcp: { support: 'SUPPORTED' as const },
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities,
			engineIdentityId: 'test-engine',
			linkId: 1,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			listMcpServers: async () => ({ servers: [stdioServer()] }),
			addMcpServer: async request => {
				addRequests.push(request);
				return { ok: true, assignedId: 'added' };
			},
			updateMcpServer: async request => {
				updateRequests.push(request);
				return { ok: true };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineMcpSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		await timeout(0);
		const dialog = instantiationService.get(IDialogService) as TestDialogService;
		assert.strictEqual(section.canWrite(), true);
		return { section, dialog, addRequests, updateRequests };
	}

	async function clickMcpToolbar(section: EngineMcpSection, label: 'Add' | 'Update'): Promise<void> {
		const button = section.getDomNode().querySelector(`[aria-label="${label}"]`);
		assert.ok(button instanceof HTMLElement, label);
		button.click();
		await timeout(0);
	}

	function assertWriteStatusHidden(section: EngineMcpSection): void {
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status');
		assert.ok(writeStatus instanceof HTMLElement);
		assert.strictEqual(writeStatus.style.display, 'none');
		assert.notStrictEqual(writeStatus.textContent, ENGINE_MCP_UPDATE_SUCCESS_COPY);
	}

	function assertEnvLineError(section: EngineMcpSection): void {
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status');
		assert.ok(writeStatus instanceof HTMLElement);
		assert.strictEqual(writeStatus.textContent, envInvalidCopy);
		assert.ok(writeStatus.classList.contains('is-error'));
		const catalog = section.getDomNode().querySelector('.engine-catalog-status-widget');
		assert.ok(catalog instanceof HTMLElement);
		assert.notStrictEqual(catalog.dataset['catalogMode'], 'failed');
	}

	test('MCP dialog add sends args and env, global scope, and does not set enabled', async () => {
		const { section, dialog, addRequests } = await mountReadyMcp();
		stubMcpDialog(dialog, [
			'Added MCP',
			'stdio',
			'npx',
			'http://should-not-send',
			'-y\n \n mcp-demo \n',
			'TOKEN=one\n OTHER = 2 \nTOKEN=two\nPATH=a=b\nEMPTY=\n',
		], assertMcpDialogShape);
		await clickMcpToolbar(section, 'Add');
		assert.strictEqual(addRequests.length, 1);
		assert.strictEqual(addRequests[0]!.scope, 'global');
		assert.deepStrictEqual(addRequests[0]!.config, {
			name: 'Added MCP',
			transport: 'stdio',
			command: 'npx',
			args: ['-y', 'mcp-demo'],
			env: { TOKEN: 'two', OTHER: '2', PATH: 'a=b', EMPTY: '' },
		});
	});

	test('MCP dialog add with blank args and env omits those keys', async () => {
		const { section, dialog, addRequests } = await mountReadyMcp();
		stubMcpDialog(dialog, ['Blank MCP', 'stdio', 'echo', '', '', ''], assertMcpDialogShape);
		await clickMcpToolbar(section, 'Add');
		stubMcpDialog(dialog, ['Whitespace MCP', 'stdio', 'echo', '', ' \n\t', ' \r\n ']);
		await clickMcpToolbar(section, 'Add');
		assert.strictEqual(addRequests.length, 2);
		assert.deepStrictEqual(addRequests[0]!.config, { name: 'Blank MCP', transport: 'stdio', command: 'echo' });
		assert.deepStrictEqual(addRequests[1]!.config, { name: 'Whitespace MCP', transport: 'stdio', command: 'echo' });
		assert.ok(addRequests.every(request => request.scope === 'global'));
	});

	test('MCP dialog edit with blank args and env does not update when nothing else changed', async () => {
		const { section, dialog, updateRequests } = await mountReadyMcp();
		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		stubMcpDialog(dialog, ['Demo MCP', 'stdio', 'npx', 'http://mcp', '', ''], input => {
			assertMcpDialogShape(input);
			assert.strictEqual(input.inputs[4]?.value, '-y\nmcp-demo');
			assert.strictEqual(input.inputs[5]?.value, 'TOKEN=secret');
		});
		await clickMcpToolbar(section, 'Update');
		assert.deepStrictEqual(updateRequests, []);
		assertWriteStatusHidden(section);
	});

	test('MCP dialog edit that only changes an argument updates args and keeps env and enabled', async () => {
		const { section, dialog, updateRequests } = await mountReadyMcp();
		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		stubMcpDialog(dialog, [
			'Demo MCP',
			'stdio',
			'npx',
			'http://changed',
			'-y\nmcp-demo\n--extra',
			'',
		], assertMcpDialogShape);
		await clickMcpToolbar(section, 'Update');
		assert.strictEqual(updateRequests.length, 1);
		assert.strictEqual(updateRequests[0]!.scope, 'global');
		assert.deepStrictEqual(updateRequests[0]!.config, {
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio',
			command: 'npx',
			args: ['-y', 'mcp-demo', '--extra'],
			env: { TOKEN: 'secret' },
			url: 'http://mcp',
			enabled: false,
		});
	});

	test('MCP dialog invalid environment line does not add or update', async () => {
		const { section, dialog, addRequests, updateRequests } = await mountReadyMcp();
		stubMcpDialog(dialog, ['Added MCP', 'stdio', 'npx', '', '-y', 'NOT_A_PAIR'], assertMcpDialogShape);
		await clickMcpToolbar(section, 'Add');
		assert.deepStrictEqual(addRequests, []);
		assertEnvLineError(section);

		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		stubMcpDialog(dialog, ['Demo MCP', 'stdio', 'npx', 'http://mcp', '-y\nmcp-demo', '=nokey']);
		await clickMcpToolbar(section, 'Update');
		assert.deepStrictEqual(updateRequests, []);
		assertEnvLineError(section);
	});

	test('MCP dialog stdio url-only edit does not update', async () => {
		const { section, dialog, updateRequests } = await mountReadyMcp();
		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		stubMcpDialog(dialog, [
			'Demo MCP',
			'stdio',
			'npx',
			'http://changed',
			'-y\nmcp-demo',
			'TOKEN=secret',
		], assertMcpDialogShape);
		await clickMcpToolbar(section, 'Update');
		assert.deepStrictEqual(updateRequests, []);
		assertWriteStatusHidden(section);
	});

	test('MCP addServer() without config does not call addMcpServer', async () => {
		const { section, addRequests } = await mountReadyMcp();
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(await section.addServer(), false);
		assert.deepStrictEqual(addRequests, []);
		assertWriteStatusHidden(section);
	});
});
