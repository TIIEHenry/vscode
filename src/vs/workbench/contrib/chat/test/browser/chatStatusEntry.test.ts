/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IInlineCompletionsService } from '../../../../../editor/browser/services/inlineCompletionsService.js';
import { ContextKeyExpression, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { ChatEntitlement, IChatEntitlementService, IChatSentiment } from '../../../../services/chat/common/chatEntitlementService.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService } from '../../../../services/statusbar/browser/statusbar.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { InEditorZenModeContext } from '../../../../common/contextkeys.js';
import { ChatQuotaResumeState, ChatStatusBarEntry, computeQuotaResumeState } from '../../browser/chatStatus/chatStatusEntry.js';
import { IChatStatusItemService } from '../../browser/chatStatus/chatStatusItemService.js';
import { UpdateTitleBarChatInProgressContext, UpdateTitleBarContext, UpdateTitleBarEditorVisibleContext } from '../../../update/common/update.js';

type Quotas = IChatEntitlementService['quotas'];

const exhausted = { percentRemaining: 0, unlimited: false } as const;
const available = { percentRemaining: 100, unlimited: false } as const;
const pooledDepleted = { percentRemaining: 0, unlimited: true, hasQuota: false } as const;
const pooledAvailable = { percentRemaining: 100, unlimited: true, hasQuota: true } as const;

const RESUME_STATE_KEY = 'chat.quotaResumeState';

class TestContextKeyService extends MockContextKeyService {
	override contextMatchesRules(rules: ContextKeyExpression): boolean {
		return rules.evaluate({ getValue: key => this.getContextKeyValue(key) });
	}
}

suite('ChatStatusBarEntry - computeQuotaResumeState', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	interface IScenario {
		readonly name: string;
		readonly previous: ChatQuotaResumeState;
		readonly entitlement: ChatEntitlement;
		readonly quotas: Quotas;
		readonly expected: ChatQuotaResumeState;
	}

	const scenarios: IScenario[] = [
		// Free: enter blocked when premium chat is exhausted
		{ name: 'free not blocked stays none', previous: 'none', entitlement: ChatEntitlement.Free, quotas: { premiumChat: available }, expected: 'none' },
		{ name: 'free premium exhausted becomes blocked', previous: 'none', entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted }, expected: 'blocked' },

		// Free: reset after being blocked surfaces "resumed"
		{ name: 'free reset after blocked becomes resumed', previous: 'blocked', entitlement: ChatEntitlement.Free, quotas: { premiumChat: available }, expected: 'resumed' },
		{ name: 'free still exhausted stays blocked', previous: 'blocked', entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted }, expected: 'blocked' },

		// Offline / unresolved quota: do not falsely resume, keep blocked until fresh data
		{ name: 'free no quota data keeps blocked', previous: 'blocked', entitlement: ChatEntitlement.Free, quotas: {}, expected: 'blocked' },

		// Additional spend: never blocked, and never surfaces resumed
		{ name: 'free exhausted with additional spend not blocked', previous: 'none', entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted, additionalUsageEnabled: true }, expected: 'none' },
		{ name: 'blocked then additional spend clears to none', previous: 'blocked', entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted, additionalUsageEnabled: true }, expected: 'none' },

		// Resumed persists until dismissed
		{ name: 'resumed persists while not blocked', previous: 'resumed', entitlement: ChatEntitlement.Free, quotas: { premiumChat: available }, expected: 'resumed' },
		{ name: 'resumed overridden when blocked again', previous: 'resumed', entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted }, expected: 'blocked' },

		// Pooled Business/Enterprise
		{ name: 'business pooled depleted becomes blocked', previous: 'none', entitlement: ChatEntitlement.Business, quotas: { premiumChat: pooledDepleted }, expected: 'blocked' },
		{ name: 'enterprise pooled depleted becomes blocked', previous: 'none', entitlement: ChatEntitlement.Enterprise, quotas: { premiumChat: pooledDepleted }, expected: 'blocked' },
		{ name: 'business pooled depleted with additional spend not blocked', previous: 'none', entitlement: ChatEntitlement.Business, quotas: { premiumChat: pooledDepleted, additionalUsageEnabled: true }, expected: 'none' },
		{ name: 'business reset after blocked becomes resumed', previous: 'blocked', entitlement: ChatEntitlement.Business, quotas: { premiumChat: pooledAvailable }, expected: 'resumed' },

		// Paid individual plans (Pro/Pro+/EDU): tracked via premium chat quota
		{ name: 'pro premium exhausted becomes blocked', previous: 'none', entitlement: ChatEntitlement.Pro, quotas: { premiumChat: exhausted }, expected: 'blocked' },
		{ name: 'pro plus premium exhausted becomes blocked', previous: 'none', entitlement: ChatEntitlement.ProPlus, quotas: { premiumChat: exhausted }, expected: 'blocked' },
		{ name: 'edu premium exhausted becomes blocked', previous: 'none', entitlement: ChatEntitlement.EDU, quotas: { premiumChat: exhausted }, expected: 'blocked' },
		{ name: 'pro reset after blocked becomes resumed', previous: 'blocked', entitlement: ChatEntitlement.Pro, quotas: { premiumChat: available }, expected: 'resumed' },
		{ name: 'pro premium with additional spend not blocked', previous: 'none', entitlement: ChatEntitlement.Pro, quotas: { premiumChat: exhausted, additionalUsageEnabled: true }, expected: 'none' },
		{ name: 'pro no quota data keeps blocked', previous: 'blocked', entitlement: ChatEntitlement.Pro, quotas: {}, expected: 'blocked' },

		// Untracked audience (signed out / unresolved / not entitled): never tracked
		{ name: 'unresolved while blocked clears to none', previous: 'blocked', entitlement: ChatEntitlement.Unresolved, quotas: {}, expected: 'none' },
		{ name: 'unavailable resumed clears to none', previous: 'resumed', entitlement: ChatEntitlement.Unavailable, quotas: {}, expected: 'none' },
	];

	test('state transitions', () => {
		const actual = scenarios.map(s => ({ name: s.name, state: computeQuotaResumeState(s.previous, s.entitlement, s.quotas) }));
		const expected = scenarios.map(s => ({ name: s.name, state: s.expected }));
		assert.deepStrictEqual(actual, expected);
	});
});

suite('ChatStatusBarEntry', () => {

	// INV-NO-COPILOT: default window must not show the Copilot StatusBar entry.
	// Quota resume state logic still runs; UI assertions below expect no status bar entry.

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEntitlement(opts: { quotas?: Quotas; entitlement?: ChatEntitlement; sentiment?: IChatSentiment }) {
		const quotaExceeded = store.add(new Emitter<void>());
		const quotaRemaining = store.add(new Emitter<void>());
		const sentimentChanged = store.add(new Emitter<void>());
		const entitlementChanged = store.add(new Emitter<void>());

		return {
			_serviceBrand: undefined,
			quotas: (opts.quotas ?? {}) as Quotas,
			entitlement: opts.entitlement ?? ChatEntitlement.Free,
			sentiment: (opts.sentiment ?? { completed: true }) as IChatSentiment,
			onDidChangeQuotaExceeded: quotaExceeded.event,
			onDidChangeQuotaRemaining: quotaRemaining.event,
			onDidChangeSentiment: sentimentChanged.event,
			onDidChangeEntitlement: entitlementChanged.event,
			update: () => Promise.resolve(),
			fireQuotaExceeded: () => quotaExceeded.fire(),
			fireQuotaRemaining: () => quotaRemaining.fire(),
			fireSentiment: () => sentimentChanged.fire(),
			fireEntitlement: () => entitlementChanged.fire(),
		};
	}

	function createEntry(opts: { quotas?: Quotas; entitlement?: ChatEntitlement; persisted?: ChatQuotaResumeState; updateTitleBar?: boolean; updateTitleBarChatInProgress?: boolean; inDebugMode?: boolean; inZenMode?: boolean }) {
		const instantiationService = workbenchInstantiationService({
			contextKeyService: () => new TestContextKeyService(),
		}, store);
		const svc = createEntitlement(opts);

		const statusbar = {
			current: undefined as IStatusbarEntry | undefined,
			addEntry(entry: IStatusbarEntry): IStatusbarEntryAccessor {
				statusbar.current = entry;
				return { update: (e: IStatusbarEntry) => { statusbar.current = e; }, dispose: () => { } };
			}
		};

		instantiationService.stub(IChatEntitlementService, svc);
		instantiationService.stub(IStatusbarService, statusbar);
		instantiationService.stub(IInlineCompletionsService, {
			_serviceBrand: undefined,
			onDidChangeIsSnoozing: Event.None,
			isSnoozing: () => false,
			snoozeTimeLeft: 0,
			snooze: () => { },
			cancelSnooze: () => { },
		});
		instantiationService.stub(IChatStatusItemService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getEntries: () => [],
			setOrUpdateEntry: () => { },
			deleteEntry: () => { },
		});
		instantiationService.stub(IMarkdownRendererService, { _serviceBrand: undefined });
		const contextKeyService = instantiationService.get(IContextKeyService);
		UpdateTitleBarContext.bindTo(contextKeyService).set(opts.updateTitleBar ?? false);
		UpdateTitleBarChatInProgressContext.bindTo(contextKeyService).set(opts.updateTitleBarChatInProgress ?? false);
		contextKeyService.createKey<boolean>('inDebugMode', false).set(opts.inDebugMode ?? false);
		InEditorZenModeContext.bindTo(contextKeyService).set(opts.inZenMode ?? false);

		const storageService = instantiationService.get(IStorageService);
		if (opts.persisted) {
			storageService.store(RESUME_STATE_KEY, opts.persisted, StorageScope.PROFILE, StorageTarget.MACHINE);
		}

		const entry = store.add(instantiationService.createInstance(ChatStatusBarEntry));
		return {
			entry,
			svc,
			statusbar,
			storageService,
			updateTitleBarVisible: contextKeyService.contextMatchesRules(UpdateTitleBarEditorVisibleContext),
		};
	}

	function persistedState(storageService: IStorageService): string | undefined {
		return storageService.get(RESUME_STATE_KEY, StorageScope.PROFILE);
	}

	function flushTimers(): Promise<void> {
		return new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	function assertNoStatusBarEntry(statusbar: { current: IStatusbarEntry | undefined }): void {
		assert.strictEqual(statusbar.current, undefined);
	}

	test('does not add Copilot status bar entry', () => {
		const blocked = createEntry({ entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted } });
		const signedOut = createEntry({ entitlement: ChatEntitlement.Unknown });
		const resumed = createEntry({ entitlement: ChatEntitlement.Free, quotas: { premiumChat: available }, persisted: 'resumed' });

		assertNoStatusBarEntry(blocked.statusbar);
		assertNoStatusBarEntry(signedOut.statusbar);
		assertNoStatusBarEntry(resumed.statusbar);
	});

	test('tracks blocked quota state without showing status bar entry', () => {
		const { statusbar, storageService } = createEntry({ entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted } });

		assertNoStatusBarEntry(statusbar);
		assert.strictEqual(persistedState(storageService), 'blocked');
	});

	test('transitions to resumed when the limit resets while running', () => {
		const { svc, statusbar, storageService } = createEntry({ entitlement: ChatEntitlement.Free, quotas: { premiumChat: exhausted } });
		assert.strictEqual(persistedState(storageService), 'blocked');

		svc.quotas = { premiumChat: available };
		svc.fireQuotaExceeded();

		assertNoStatusBarEntry(statusbar);
		assert.strictEqual(persistedState(storageService), 'resumed');
	});

	test('restores resumed on launch when previously blocked and now reset', async () => {
		const { statusbar, storageService } = createEntry({ entitlement: ChatEntitlement.Free, quotas: { premiumChat: available }, persisted: 'blocked' });

		await flushTimers();

		assertNoStatusBarEntry(statusbar);
		assert.strictEqual(persistedState(storageService), 'resumed');
	});

	test('does not surface resumed when unblocked via additional spend', async () => {
		const { statusbar, storageService } = createEntry({ entitlement: ChatEntitlement.Business, quotas: { premiumChat: pooledAvailable, additionalUsageEnabled: true }, persisted: 'blocked' });

		await flushTimers();

		assertNoStatusBarEntry(statusbar);
		assert.strictEqual(persistedState(storageService), undefined);
	});

	test.skip('clears resumed when the dashboard is opened', async () => {
		// INV-NO-COPILOT: no status bar entry means the dashboard tooltip is unreachable.
	});

	test('resumed is overridden when the user becomes blocked again', () => {
		const { svc, statusbar, storageService } = createEntry({ entitlement: ChatEntitlement.Free, quotas: { premiumChat: available }, persisted: 'resumed' });
		assert.strictEqual(persistedState(storageService), 'resumed');

		svc.quotas = { premiumChat: exhausted };
		svc.fireQuotaExceeded();

		assertNoStatusBarEntry(statusbar);
		assert.strictEqual(persistedState(storageService), 'blocked');
	});
});
