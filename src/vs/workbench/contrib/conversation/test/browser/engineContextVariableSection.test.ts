/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableListResult,
	UniverseAgentContextVariableReadRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ENGINE_CONTEXT_VARIABLE_READ_LABEL } from '../../browser/engineContextVariableList.js';
import { EngineContextVariableSection } from '../../browser/engineContextVariableSection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

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
		assert.ok((noHook.getDomNode().textContent ?? '').includes('does not expose'));
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
		assert.ok((pane.getDomNode().textContent ?? '').includes('No context variables.'));
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
