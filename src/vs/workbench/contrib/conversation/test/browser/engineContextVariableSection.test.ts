/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableListResult,
	UniverseAgentContextVariableReadRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import {
	ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY,
	ENGINE_CONTEXT_VARIABLE_LIST_FEATURE,
	ENGINE_CONTEXT_VARIABLE_READ_LABEL,
} from '../../browser/engineContextVariableList.js';
import { EngineContextVariableSection } from '../../browser/engineContextVariableSection.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('EngineContextVariableSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountSection(connection: IUniverseAgentConnection): EngineContextVariableSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineContextVariableSection, parent));
		section.setSectionActive(true);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function findReadButton(root: HTMLElement): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-context-variable-actions .monaco-button')]
			.find(button => button.textContent === ENGINE_CONTEXT_VARIABLE_READ_LABEL) as HTMLButtonElement | undefined;
	}

	test('List does not send when disconnected or hook missing', async () => {
		let listContextVariableCalls = 0;
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			listContextVariable: async () => {
				listContextVariableCalls++;
				return { current: [], inherited: [] };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listContextVariableCalls, 0);
		assert.ok((disconnected.getDomNode().textContent ?? '').length > 0);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		assert.strictEqual(listContextVariableCalls, 0);
		assert.strictEqual(noHook.getDomNode().querySelectorAll('.engine-context-variable-row').length, 0);
		const noHookStatus = noHook.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(noHookStatus);
		assert.strictEqual(noHookStatus.dataset['catalogMode'], 'unsupported');
		assert.ok((noHook.getDomNode().textContent ?? '').includes('does not expose'));
		assert.ok(!(noHook.getDomNode().textContent ?? '').includes(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY));
		noHook.getDomNode().parentElement?.remove();
	});

	test('List sends empty sessionId / agentId as-is when connected', async () => {
		const requests: UniverseAgentContextVariableListRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listContextVariable: async (request): Promise<UniverseAgentContextVariableListResult> => {
				requests.push(request);
				return {
					current: [{
						name: '',
						scope: 'VARIABLE_GLOBAL',
						updatedBy: '',
						updatedAt: 0,
						contentPreview: '',
					}],
					inherited: [],
				};
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(requests.length, 1);
		assert.deepStrictEqual(requests[0], { sessionId: '', agentId: '' });
		const row = pane.getDomNode().querySelector('.engine-context-variable-row');
		assert.ok(row);
		assert.strictEqual(row.textContent, 'current —  — VARIABLE_GLOBAL —  — 0 — ');
		pane.getDomNode().parentElement?.remove();
	});

	test('List empty current[] / inherited[] is honest empty', async () => {
		let listContextVariableCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listContextVariable: async () => {
				listContextVariableCalls++;
				return { current: [], inherited: [] };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listContextVariableCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-context-variable-row'), null);
		assert.ok((pane.getDomNode().textContent ?? '').includes(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List first-pull throw is failed with no leftover rows', async () => {
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listContextVariable: async () => {
				throw new Error('listContextVariable exploded');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelector('.engine-context-variable-row'), null);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(ENGINE_CONTEXT_VARIABLE_LIST_FEATURE, 'listContextVariable exploded')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List success then throw keeps leftover rows and paints failed', async () => {
		let listContextVariableCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = {
			name: 'leftover-var',
			scope: 'VARIABLE_GLOBAL' as const,
			updatedBy: 'agent',
			updatedAt: 1,
			contentPreview: 'preview',
		};
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: onDidChangeConnection.event,
			listContextVariable: async (): Promise<UniverseAgentContextVariableListResult> => {
				listContextVariableCalls++;
				if (listContextVariableCalls === 1) {
					return { current: [leftover], inherited: [] };
				}
				throw new Error('listContextVariable retry exploded');
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		const liveRow = pane.getDomNode().querySelector('.engine-context-variable-row');
		assert.ok(liveRow);
		assert.strictEqual(liveRow.textContent, 'current — leftover-var — VARIABLE_GLOBAL — agent — 1 — preview');
		assert.strictEqual(listContextVariableCalls, 1);

		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(listContextVariableCalls, 2);
		const leftoverRows = pane.getDomNode().querySelectorAll('.engine-context-variable-row');
		assert.strictEqual(leftoverRows.length, 1);
		assert.strictEqual(leftoverRows[0].textContent, 'current — leftover-var — VARIABLE_GLOBAL — agent — 1 — preview');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(ENGINE_CONTEXT_VARIABLE_LIST_FEATURE, 'listContextVariable retry exploded')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List success then hook missing keeps leftover rows and paints unsupported', async () => {
		const leftover = {
			name: 'leftover-var',
			scope: 'VARIABLE_GLOBAL' as const,
			updatedBy: 'agent',
			updatedAt: 1,
			contentPreview: 'preview',
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: onDidChangeConnection.event,
			listContextVariable: async (): Promise<UniverseAgentContextVariableListResult> => {
				return { current: [leftover], inherited: [] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 1);

		delete connection.listContextVariable;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 1);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List success then disconnect clears leftover rows', async () => {
		let connected = true;
		const leftover = {
			name: 'leftover-var',
			scope: 'VARIABLE_GLOBAL' as const,
			updatedBy: 'agent',
			updatedAt: 1,
			contentPreview: 'preview',
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			getConnectionPhase: () => connected ? { kind: 'connected', path: 'loopback' } : { kind: 'disconnected' },
			onDidChangeConnection: onDidChangeConnection.event,
			listContextVariable: async (): Promise<UniverseAgentContextVariableListResult> => {
				return { current: [leftover], inherited: [] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 1);

		connected = false;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 0);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		pane.getDomNode().parentElement?.remove();
	});

	test('connected phase with pairingPending keeps leftover rows and paints not-connected', async () => {
		let connected = true;
		let pairingPending = false;
		let listContextVariableCalls = 0;
		const leftover = {
			name: 'leftover-var',
			scope: 'VARIABLE_GLOBAL' as const,
			updatedBy: 'agent',
			updatedAt: 1,
			contentPreview: 'preview',
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listContextVariable: async (): Promise<UniverseAgentContextVariableListResult> => {
				listContextVariableCalls++;
				return { current: [leftover], inherited: [] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 1);
		const listCallsAfterLoad = listContextVariableCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listContextVariableCalls, listCallsAfterLoad);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 1);
		const listHost = pane.getDomNode().querySelector('.engine-context-variable-list') as HTMLElement | null;
		assert.ok(listHost);
		assert.notStrictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY));

		connected = false;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-context-variable-row').length, 0);
		const cleared = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(cleared);
		assert.strictEqual(cleared.dataset['catalogMode'], 'disconnected');
		pane.getDomNode().parentElement?.remove();
	});

	test('Read does not send when disconnected or hook missing', async () => {
		const readCalls: UniverseAgentContextVariableReadRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			readContextVariable: async request => {
				readCalls.push(request);
				return {
					entry: {
						name: '',
						content: '',
						scope: 'VARIABLE_GLOBAL',
						updatedBy: '',
						updatedAt: 0,
					},
				};
			},
		}));
		await flushMicrotasks();
		const disconnectedRead = findReadButton(disconnected.getDomNode());
		assert.ok(disconnectedRead);
		disconnectedRead.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookRead = findReadButton(noHook.getDomNode());
		assert.ok(noHookRead);
		noHookRead.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('Read sends empty ids as-is when connected with no selection', async () => {
		const readCalls: UniverseAgentContextVariableReadRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listContextVariable: async () => ({ current: [], inherited: [] }),
			readContextVariable: async request => {
				readCalls.push(request);
				return {
					entry: {
						name: '',
						content: '',
						scope: 'VARIABLE_GLOBAL',
						updatedBy: '',
						updatedAt: 0,
					},
				};
			},
		}));
		await flushMicrotasks();
		const read = findReadButton(pane.getDomNode());
		assert.ok(read);
		read.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, [{ sessionId: '', name: '', agentId: '' }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes(' —  — VARIABLE_GLOBAL —  — 0'));
		pane.getDomNode().parentElement?.remove();
	});

	test('Read sends selected name without inventing defaults', async () => {
		const readCalls: UniverseAgentContextVariableReadRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listContextVariable: async (): Promise<UniverseAgentContextVariableListResult> => ({
				current: [],
				inherited: [{
					name: '  var  ',
					scope: 'VARIABLE_LOCAL',
					updatedBy: '',
					updatedAt: 0,
					contentPreview: '  preview  ',
				}],
			}),
			readContextVariable: async request => {
				readCalls.push(request);
				return {
					entry: {
						name: '  var  ',
						content: '  body  ',
						scope: 'VARIABLE_LOCAL',
						updatedBy: '',
						updatedAt: 0,
					},
				};
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-context-variable-row') as HTMLElement;
		assert.ok(row);
		assert.strictEqual(row.textContent, 'inherited —   var   — VARIABLE_LOCAL —  — 0 —   preview  ');
		row.click();
		const read = findReadButton(pane.getDomNode());
		assert.ok(read);
		read.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, [{ sessionId: '', name: '  var  ', agentId: '' }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes('  var   —   body   — VARIABLE_LOCAL —  — 0'));
		pane.getDomNode().parentElement?.remove();
	});
});
