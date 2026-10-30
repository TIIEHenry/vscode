/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentDeleteMemoryRequest, UniverseAgentMemoryListRequest, UniverseAgentMemorySearchRequest, UniverseAgentSaveMemoryRequest } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { EngineMemorySection } from '../../browser/engineMemorySection.js';
import { getEngineSectionApiUnavailableCopy } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('EngineMemorySection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createMemoryConnection(options: {
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
		engineIdentityId?: string;
		linkId?: number;
		listMemory?: IUniverseAgentConnection['listMemory'];
		searchMemory?: IUniverseAgentConnection['searchMemory'];
		saveMemory?: IUniverseAgentConnection['saveMemory'];
		deleteMemory?: IUniverseAgentConnection['deleteMemory'];
	} = {}): IUniverseAgentConnection {
		const connected = options.connected ?? false;
		const pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		const capabilities = createEmptyTestCapabilitySnapshot();
		return createConversationConnectionTestStub({
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				authenticated: connected,
				pairingPending,
				channelAlive: connected,
				sharedFsRootSent: false,
				engineIdentityId: connected ? options.engineIdentityId ?? 'test-engine' : undefined,
				linkId: connected ? options.linkId ?? 1 : undefined,
				capabilities,
			}),
			getCapabilitySnapshot: () => capabilities,
			listMemory: options.listMemory,
			searchMemory: options.searchMemory,
			saveMemory: options.saveMemory,
			deleteMemory: options.deleteMemory,
		});
	}

	function mountSection(connection: IUniverseAgentConnection): { section: EngineMemorySection; dialog: TestDialogService } {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const dialog = instantiationService.get(IDialogService) as TestDialogService;
		const section = store.add(instantiationService.createInstance(EngineMemorySection, parent));
		section.setSectionActive(true);
		return { section, dialog };
	}

	test('list paints categories and search uses searchMemory', async () => {
		const lists: UniverseAgentMemoryListRequest[] = [];
		const searches: UniverseAgentMemorySearchRequest[] = [];
		const connection = createMemoryConnection({
			connected: true,
			listMemory: async request => {
				lists.push(request);
				return {
					categories: [{
						category: 'notes',
						fileCount: 1,
						files: [{ filename: 'a.md', title: 'Alpha', updatedAt: 1 }],
					}],
				};
			},
			searchMemory: async request => {
				searches.push(request);
				return {
					results: [{
						category: 'notes',
						filename: 'a.md',
						title: 'Alpha',
						score: 1,
						snippet: 'found',
						forgot: false,
						scope: 'global',
					}],
				};
			},
			saveMemory: async request => ({ success: true, message: '', filePath: request.category }),
			deleteMemory: async () => ({ success: true, message: '' }),
		});
		const { section } = mountSection(connection);
		await timeout(0);
		const root = section.getDomNode();
		assert.ok(root.textContent?.includes('Alpha'));
		assert.strictEqual(section.getItemCount(), 1);
		assert.deepStrictEqual(lists, [{ scope: 'global', category: '' }]);

		const filter = root.querySelector('input.engine-provider-catalog-filter') as HTMLInputElement;
		assert.strictEqual(filter.disabled, false);
		assert.strictEqual(filter.title, '');
		assert.strictEqual(filter.getAttribute('aria-label'), 'Search memory');
		filter.value = 'alpha';
		filter.dispatchEvent(new (filter.ownerDocument.defaultView!.Event)('input', { bubbles: true }));
		await timeout(0);
		assert.strictEqual(searches.length, 1);
		assert.deepStrictEqual(searches[0], { scope: 'global', query: 'alpha', keywords: [], limit: 50 });
		assert.strictEqual(lists.length, 1);
		assert.ok(root.textContent?.includes('found'));

		filter.value = '';
		filter.dispatchEvent(new (filter.ownerDocument.defaultView!.Event)('input', { bubbles: true }));
		await timeout(0);
		assert.strictEqual(lists.length, 2);
		root.parentElement?.remove();
	});

	test('typed query without searchMemory does not keep the list as hits', async () => {
		const lists: UniverseAgentMemoryListRequest[] = [];
		const connection = createMemoryConnection({
			connected: true,
			listMemory: async request => {
				lists.push(request);
				return {
					categories: [{
						category: 'notes',
						fileCount: 1,
						files: [{ filename: 'a.md', title: 'Alpha', updatedAt: 1 }],
					}],
				};
			},
			saveMemory: async request => ({ success: true, message: '', filePath: request.category }),
		});
		const { section } = mountSection(connection);
		await timeout(0);
		const root = section.getDomNode();
		assert.ok(root.textContent?.includes('Alpha'));
		assert.strictEqual(lists.length, 1);

		const filter = root.querySelector('input.engine-provider-catalog-filter') as HTMLInputElement;
		filter.value = 'alpha';
		filter.dispatchEvent(new (filter.ownerDocument.defaultView!.Event)('input', { bubbles: true }));
		await timeout(0);
		const text = root.textContent ?? '';
		assert.strictEqual(lists.length, 1);
		assert.ok(text.includes('Search is unavailable.'));
		assert.ok(!text.includes('No memory.'));
		assert.ok(!text.includes('Alpha'));
		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(filter.disabled, false);
		const writeStatus = root.querySelector('.engine-memory-write-status') as HTMLElement;
		assert.strictEqual(writeStatus.style.display, 'none');
		const add = root.querySelector('[aria-label="Add memory"]') as HTMLElement;
		assert.notStrictEqual(add.style.display, 'none');

		filter.value = '';
		filter.dispatchEvent(new (filter.ownerDocument.defaultView!.Event)('input', { bubbles: true }));
		await timeout(0);
		assert.strictEqual(lists.length, 2);
		assert.ok((root.textContent ?? '').includes('Alpha'));
		assert.ok(!(root.textContent ?? '').includes('Search is unavailable.'));
		root.parentElement?.remove();
	});

	test('search with no hits says no matching memory', async () => {
		const lists: UniverseAgentMemoryListRequest[] = [];
		let files: { filename: string; title: string; updatedAt: number }[] = [{ filename: 'a.md', title: 'Alpha', updatedAt: 1 }];
		const connection = createMemoryConnection({
			connected: true,
			listMemory: async request => {
				lists.push(request);
				return {
					categories: files.length === 0 ? [] : [{
						category: 'notes',
						fileCount: files.length,
						files,
					}],
				};
			},
			searchMemory: async () => ({ results: [] }),
		});
		const { section } = mountSection(connection);
		await timeout(0);
		const root = section.getDomNode();
		assert.ok(root.textContent?.includes('Alpha'));

		const filter = root.querySelector('input.engine-provider-catalog-filter') as HTMLInputElement;
		const setQuery = async (value: string) => {
			filter.value = value;
			filter.dispatchEvent(new (filter.ownerDocument.defaultView!.Event)('input', { bubbles: true }));
			await timeout(0);
		};
		await setQuery('missing');
		let text = root.textContent ?? '';
		assert.strictEqual(lists.length, 1);
		assert.ok(text.includes('No matching memory.'));
		assert.ok(!text.includes('No memory.'));
		assert.ok(!text.includes('Alpha'));
		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(root.querySelectorAll('.engine-memory-row').length, 0);

		await setQuery('');
		text = root.textContent ?? '';
		assert.strictEqual(lists.length, 2);
		assert.ok(text.includes('Alpha'));
		assert.ok(!text.includes('No matching memory.'));

		files = [];
		await setQuery('missing');
		text = root.textContent ?? '';
		assert.ok(text.includes('No matching memory.'));
		assert.ok(!text.includes('No memory.'));
		await setQuery('');
		text = root.textContent ?? '';
		assert.strictEqual(lists.length, 3);
		assert.ok(text.includes('No memory.'));
		assert.ok(!text.includes('No matching memory.'));
		assert.ok(!text.includes('Alpha'));
		root.parentElement?.remove();
	});

	test('add sends global scope and empty content does not save', async () => {
		const saves: UniverseAgentSaveMemoryRequest[] = [];
		const connection = createMemoryConnection({
			connected: true,
			listMemory: async () => ({ categories: [] }),
			saveMemory: async request => {
				saves.push(request);
				return { success: true, message: '', filePath: 'notes/a.md' };
			},
		});
		const { section, dialog } = mountSection(connection);
		await timeout(0);
		const add = section.getDomNode().querySelector('[aria-label="Add memory"]') as HTMLButtonElement;
		dialog.setInputResult({ confirmed: true, values: ['  ', 'notes'] });
		add.click();
		await timeout(0);
		assert.strictEqual(saves.length, 0);
		assert.ok((section.getDomNode().textContent ?? '').includes('Content is required.'));

		dialog.setInputResult({ confirmed: true, values: ['remember this', 'notes'] });
		add.click();
		await timeout(0);
		assert.deepStrictEqual(saves, [{ scope: 'global', content: 'remember this', category: 'notes' }]);
		section.getDomNode().parentElement?.remove();
	});

	test('delete confirm calls deleteMemory and cancel does not', async () => {
		const deletes: UniverseAgentDeleteMemoryRequest[] = [];
		const connection = createMemoryConnection({
			connected: true,
			listMemory: async () => ({
				categories: [{
					category: 'notes',
					fileCount: 1,
					files: [{ filename: 'a.md', title: 'Alpha', updatedAt: 1 }],
				}],
			}),
			deleteMemory: async request => {
				deletes.push(request);
				return { success: true, message: '' };
			},
			saveMemory: async request => ({ success: true, message: '', filePath: request.content }),
		});
		const { section } = mountSection(connection);
		await timeout(0);
		const button = section.getDomNode().querySelector('[aria-label="Delete Alpha"]') as HTMLButtonElement;
		assert.ok(button);
		button.click();
		await timeout(0);
		assert.strictEqual(deletes.length, 0);
		const confirm = document.querySelector('.engine-confirm-popover-confirm') as HTMLButtonElement | null;
		assert.ok(confirm);
		confirm.click();
		await timeout(0);
		assert.deepStrictEqual(deletes, [{ scope: 'global', category: 'notes', filename: 'a.md' }]);
		section.getDomNode().parentElement?.remove();
	});

	test('does not paint save success after the engine link changes', async () => {
		let releaseSave!: () => void;
		const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
		const connectionOptions: Parameters<typeof createMemoryConnection>[0] = {
			connected: true,
			linkId: 1,
			listMemory: async () => ({ categories: [] }),
			saveMemory: async request => {
				await saveGate;
				return { success: true, message: '', filePath: request.category };
			},
		};
		const connection = createMemoryConnection(connectionOptions);
		const { section, dialog } = mountSection(connection);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['remember this', 'notes'] });
		(section.getDomNode().querySelector('[aria-label="Add memory"]') as HTMLButtonElement).click();
		await timeout(0);
		connectionOptions.linkId = 2;
		releaseSave();
		await timeout(0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Memory saved.'));
		section.getDomNode().parentElement?.remove();
	});

	test('missing saveMemory hides Add and pairing-hold does not write', async () => {
		const saves: UniverseAgentSaveMemoryRequest[] = [];
		const readOnly = createMemoryConnection({
			connected: true,
			listMemory: async () => ({ categories: [] }),
		});
		const readOnlyMount = mountSection(readOnly);
		await timeout(0);
		const add = readOnlyMount.section.getDomNode().querySelector('[aria-label="Add memory"]') as HTMLButtonElement;
		assert.strictEqual(add.style.display, 'none');
		readOnlyMount.section.getDomNode().parentElement?.remove();

		const held = createMemoryConnection({
			connected: true,
			pairingPending: true,
			looksLive: true,
			listMemory: async () => ({ categories: [] }),
			saveMemory: async request => {
				saves.push(request);
				return { success: true, message: '', filePath: '' };
			},
		});
		const { section, dialog } = mountSection(held);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['text', 'notes'] });
		(section.getDomNode().querySelector('[aria-label="Add memory"]') as HTMLButtonElement).click();
		await timeout(0);
		assert.strictEqual(saves.length, 0);
		section.getDomNode().parentElement?.remove();
	});

	test('missing listMemory is unavailable and a late list after dispose does not paint', async () => {
		const missing = createMemoryConnection({ connected: true });
		const missingMount = mountSection(missing);
		await timeout(0);
		const unavailable = getEngineSectionApiUnavailableCopy('memory');
		assert.ok((missingMount.section.getDomNode().textContent ?? '').includes(unavailable));
		const missingFilter = missingMount.section.getDomNode().querySelector('input.engine-provider-catalog-filter') as HTMLInputElement;
		assert.strictEqual(missingFilter.disabled, true);
		assert.strictEqual(missingFilter.title, unavailable);
		assert.strictEqual(missingFilter.getAttribute('aria-label'), `Search memory. ${unavailable}`);
		missingMount.section.getDomNode().parentElement?.remove();

		const disconnected = createMemoryConnection({ listMemory: async () => ({ categories: [] }) });
		const disconnectedMount = mountSection(disconnected);
		await timeout(0);
		const disconnectedFilter = disconnectedMount.section.getDomNode().querySelector('input.engine-provider-catalog-filter') as HTMLInputElement;
		const disconnectedReason = 'No engine connected. Connect from Connection preferences to load this section.';
		assert.strictEqual(disconnectedFilter.disabled, true);
		assert.strictEqual(disconnectedFilter.title, disconnectedReason);
		assert.strictEqual(disconnectedFilter.getAttribute('aria-label'), `Search memory. ${disconnectedReason}`);
		disconnectedMount.section.getDomNode().parentElement?.remove();

		let resolveList: (value: { categories: [] }) => void = () => { };
		const pending = createMemoryConnection({
			connected: true,
			listMemory: () => new Promise(resolve => {
				resolveList = resolve;
			}),
		});
		const { section } = mountSection(pending);
		section.dispose();
		resolveList({ categories: [] });
		await timeout(0);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-memory-row').length, 0);
		section.getDomNode().parentElement?.remove();
	});
});
