/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentCapabilitySnapshot, UniverseAgentConnectionSnapshot, UniverseAgentDeleteProjectRuleRequest, UniverseAgentProjectRule, UniverseAgentUpsertProjectRuleRequest } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
import { EngineRulesSection } from '../../browser/engineRulesSection.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { engineWriteUnconfirmedCopy } from '../../browser/engineWriteGate.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

const RULES_FEATURE = 'rules catalog';

suite('EngineRulesSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function unsupportedRulesCapabilities(): UniverseAgentCapabilitySnapshot {
		return {
			...createEmptyTestCapabilitySnapshot(),
			globalRules: { support: 'UNSUPPORTED', reason: 'no rules RPC' },
			projectRules: { support: 'UNSUPPORTED', reason: 'no rules RPC' },
		};
	}

	function createRulesConnection(options: {
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
		engineIdentityId?: string;
		linkId?: number;
		capabilities?: UniverseAgentCapabilitySnapshot;
		listProjectRules?: IUniverseAgentConnection['listProjectRules'];
		upsertProjectRule?: IUniverseAgentConnection['upsertProjectRule'];
		deleteProjectRule?: IUniverseAgentConnection['deleteProjectRule'];
		onDidChangeConnection?: IUniverseAgentConnection['onDidChangeConnection'];
	} = {}): IUniverseAgentConnection {
		const connected = options.connected ?? false;
		const pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		const capabilities = options.capabilities ?? unsupportedRulesCapabilities();
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
			listProjectRules: options.listProjectRules,
			upsertProjectRule: options.upsertProjectRule,
			deleteProjectRule: options.deleteProjectRule,
			...(options.onDidChangeConnection ? { onDidChangeConnection: options.onDidChangeConnection } : {}),
		});
	}

	function supportedRules(): UniverseAgentCapabilitySnapshot {
		return {
			...createEmptyTestCapabilitySnapshot(),
			globalRules: { support: 'SUPPORTED' },
			projectRules: { support: 'SUPPORTED' },
		};
	}

	function mountWritable(connection: IUniverseAgentConnection): { section: EngineRulesSection; dialog: TestDialogService } {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const dialog = instantiationService.get(IDialogService) as TestDialogService;
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		return { section, dialog };
	}

	const savedRule: UniverseAgentProjectRule = {
		id: 'rule-1',
		title: 'Ship it',
		enabled: true,
		priority: 2,
		body: 'body text',
		scope: 2,
		globs: ['*.ts'],
		appliesTo: ['agent'],
	};

	function mountSection(connection: IUniverseAgentConnection): EngineRulesSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		return section;
	}

	function catalogStatus(root: HTMLElement): HTMLElement {
		return root.querySelector('.engine-catalog-status-widget') as HTMLElement;
	}

	test('leftover-looks-live pairing-hold paints disconnected status, not capability/unsupported-as-live', () => {
		const connection = createRulesConnection({ connected: true, pairingPending: true, looksLive: true });
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const section = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(text.includes(getEngineSectionDisconnectedCopy()), text);
		assert.ok(!text.includes(getCatalogUnsupportedCopy(RULES_FEATURE, 'no rules RPC')), text);
		assert.ok(!text.includes(getEngineSectionApiUnavailableCopy(RULES_FEATURE)), text);
		assert.notStrictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.notStrictEqual(status.dataset['catalogMode'], 'loading');

		section.getDomNode().parentElement?.remove();
	});

	test('true connected without pairing keeps capability/unsupported path', () => {
		const connection = createRulesConnection({ connected: true, pairingPending: false });
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(text.includes(getCatalogUnsupportedCopy(RULES_FEATURE, 'no rules RPC')), text);
		assert.ok(!text.includes(getEngineSectionDisconnectedCopy()), text);

		section.getDomNode().parentElement?.remove();
	});

	test('true disconnect still paints disconnected status', () => {
		const connection = createRulesConnection({ connected: false, pairingPending: false });
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(text.includes(getEngineSectionDisconnectedCopy()), text);
		assert.ok(!text.includes(getEngineSectionApiUnavailableCopy(RULES_FEATURE)), text);

		section.getDomNode().parentElement?.remove();
	});

	test('does not leak unhandled rejection when refresh catch-path render throws and onUnexpectedError warn-then-rethrows', async () => {
		// refresh() already catches list throw; a lone inner reject does not leak.
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
			const connection = createRulesConnection({
				connected: true,
				capabilities: {
					...createEmptyTestCapabilitySnapshot(),
					globalRules: { support: 'SUPPORTED' },
					projectRules: { support: 'SUPPORTED' },
				},
				listProjectRules: async () => {
					throw new Error('list boom');
				},
			});
			const section = mountSection(connection);
			const status = (section as unknown as { status: { render(options: { readonly mode: string }): void } }).status;
			const originalRender = status.render.bind(status);
			status.render = (options: { readonly mode: string }) => {
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

	test('add global rule sends scope 2 and the dialog fields', async () => {
		const upserts: UniverseAgentUpsertProjectRuleRequest[] = [];
		const connection = createRulesConnection({
			connected: true,
			capabilities: supportedRules(),
			listProjectRules: async () => ({ rules: [] }),
			upsertProjectRule: async request => {
				upserts.push(request);
				return request.rule;
			},
		});
		const { section, dialog } = mountWritable(connection);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['Ship it', 'body text', '2'], checkboxChecked: true });
		(section.getDomNode().querySelector('[aria-label="Add global rule"]') as HTMLButtonElement).click();
		await timeout(0);
		assert.strictEqual(upserts.length, 1);
		assert.deepStrictEqual(upserts[0], {
			scope: 2,
			sessionId: '',
			rule: {
				id: '',
				title: 'Ship it',
				enabled: true,
				priority: 2,
				body: 'body text',
				scope: 2,
				globs: [],
				appliesTo: [],
			},
		});
		section.getDomNode().parentElement?.remove();
	});

	test('edit keeps id, globs, and appliesTo', async () => {
		const upserts: UniverseAgentUpsertProjectRuleRequest[] = [];
		const connection = createRulesConnection({
			connected: true,
			capabilities: supportedRules(),
			listProjectRules: async request => ({ rules: request.scope === 2 ? [savedRule] : [] }),
			upsertProjectRule: async request => {
				upserts.push(request);
				return request.rule;
			},
		});
		const { section, dialog } = mountWritable(connection);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['Renamed', '', ''], checkboxChecked: false });
		(section.getDomNode().querySelector('[aria-label="Edit Ship it"]') as HTMLButtonElement).click();
		await timeout(0);
		assert.strictEqual(upserts.length, 1);
		assert.strictEqual(upserts[0].rule.id, 'rule-1');
		assert.deepStrictEqual(upserts[0].rule.globs, ['*.ts']);
		assert.deepStrictEqual(upserts[0].rule.appliesTo, ['agent']);
		assert.strictEqual(upserts[0].rule.priority, 2);
		assert.strictEqual(upserts[0].rule.enabled, false);
		assert.strictEqual(upserts[0].rule.body, '');
		section.getDomNode().parentElement?.remove();
	});

	test('blank title does not upsert', async () => {
		const upserts: UniverseAgentUpsertProjectRuleRequest[] = [];
		const connection = createRulesConnection({
			connected: true,
			capabilities: supportedRules(),
			listProjectRules: async () => ({ rules: [] }),
			upsertProjectRule: async request => {
				upserts.push(request);
				return request.rule;
			},
		});
		const { section, dialog } = mountWritable(connection);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['  ', 'body', '1'], checkboxChecked: true });
		(section.getDomNode().querySelector('[aria-label="Add global rule"]') as HTMLButtonElement).click();
		await timeout(0);
		assert.strictEqual(upserts.length, 0);
		assert.ok((section.getDomNode().textContent ?? '').includes('Title is required.'));
		section.getDomNode().parentElement?.remove();
	});

	test('delete confirm calls delete and cancel does not', async () => {
		const deletes: UniverseAgentDeleteProjectRuleRequest[] = [];
		const connection = createRulesConnection({
			connected: true,
			capabilities: supportedRules(),
			listProjectRules: async request => ({ rules: request.scope === 2 ? [savedRule] : [] }),
			deleteProjectRule: async request => {
				deletes.push(request);
				return { deleted: true };
			},
			upsertProjectRule: async request => request.rule,
		});
		const { section } = mountWritable(connection);
		await timeout(0);
		const button = section.getDomNode().querySelector('[aria-label="Delete Ship it"]') as HTMLButtonElement;
		button.click();
		await timeout(0);
		assert.strictEqual(deletes.length, 0);
		const confirm = document.querySelector('.engine-confirm-popover-confirm') as HTMLButtonElement | null;
		assert.ok(confirm);
		confirm.click();
		await timeout(0);
		assert.deepStrictEqual(deletes, [{ scope: 2, sessionId: '', id: 'rule-1' }]);
		section.getDomNode().parentElement?.remove();
	});

	test('does not paint save success after the engine link changes', async () => {
		let releaseUpsert!: () => void;
		const upsertGate = new Promise<void>(resolve => { releaseUpsert = resolve; });
		const emitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connectionOptions: Parameters<typeof createRulesConnection>[0] = {
			connected: true,
			linkId: 1,
			onDidChangeConnection: emitter.event,
			capabilities: supportedRules(),
			listProjectRules: async () => ({ rules: [] }),
			upsertProjectRule: async request => {
				await upsertGate;
				return request.rule;
			},
		};
		const connection = createRulesConnection(connectionOptions);
		const { section, dialog } = mountWritable(connection);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['Ship it', 'body text', '2'], checkboxChecked: true });
		(section.getDomNode().querySelector('[aria-label="Add global rule"]') as HTMLButtonElement).click();
		await timeout(0);
		connectionOptions.linkId = 2;
		releaseUpsert();
		await timeout(0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Rule saved.'));
		assert.ok((section.getDomNode().textContent ?? '').includes(engineWriteUnconfirmedCopy()));
		emitter.fire(connection.getConnectionSnapshot());
		await timeout(0);
		assert.ok((section.getDomNode().textContent ?? '').includes(engineWriteUnconfirmedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Rule saved.'));
		section.getDomNode().parentElement?.remove();
	});

	test('save still shows success when a refresh puts the section in loading', async () => {
		let releaseUpsert!: () => void;
		const upsertGate = new Promise<void>(resolve => { releaseUpsert = resolve; });
		const releaseStaleLists: Array<(value: { rules: [] }) => void> = [];
		let lists = 0;
		const emitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createRulesConnection({
			connected: true,
			onDidChangeConnection: emitter.event,
			capabilities: supportedRules(),
			listProjectRules: () => {
				lists++;
				if (lists <= 2 || lists >= 5) {
					return Promise.resolve({ rules: [] });
				}
				return new Promise(resolve => {
					releaseStaleLists.push(resolve);
				});
			},
			upsertProjectRule: async request => {
				await upsertGate;
				return request.rule;
			},
		});
		const { section, dialog } = mountWritable(connection);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['Ship it', 'body text', '2'], checkboxChecked: true });
		(section.getDomNode().querySelector('[aria-label="Add global rule"]') as HTMLButtonElement).click();
		await timeout(0);
		emitter.fire(connection.getConnectionSnapshot());
		await timeout(0);
		releaseUpsert();
		await timeout(0);
		assert.ok((section.getDomNode().textContent ?? '').includes('Rule saved.'));
		for (const releaseStaleList of releaseStaleLists) {
			releaseStaleList({ rules: [] });
		}
		await timeout(0);
		assert.ok((section.getDomNode().textContent ?? '').includes('Rule saved.'));
		section.getDomNode().parentElement?.remove();
	});

	test('missing upsert hides add and pairing-hold does not write', async () => {
		const upserts: UniverseAgentUpsertProjectRuleRequest[] = [];
		const readOnly = createRulesConnection({
			connected: true,
			capabilities: supportedRules(),
			listProjectRules: async () => ({ rules: [] }),
		});
		const readOnlySection = mountSection(readOnly);
		await timeout(0);
		const toolbar = readOnlySection.getDomNode().querySelector('.engine-rules-scope--global .engine-catalog-write-toolbar') as HTMLElement;
		assert.strictEqual(toolbar.style.display, 'none');
		readOnlySection.getDomNode().parentElement?.remove();

		const held = createRulesConnection({
			connected: true,
			pairingPending: true,
			looksLive: true,
			capabilities: supportedRules(),
			listProjectRules: async () => ({ rules: [] }),
			upsertProjectRule: async request => {
				upserts.push(request);
				return request.rule;
			},
		});
		const { section, dialog } = mountWritable(held);
		await timeout(0);
		dialog.setInputResult({ confirmed: true, values: ['Ship it', 'body', '1'], checkboxChecked: true });
		(section.getDomNode().querySelector('[aria-label="Add global rule"]') as HTMLButtonElement).click();
		await timeout(0);
		assert.strictEqual(upserts.length, 0);
		section.getDomNode().parentElement?.remove();
	});
});
