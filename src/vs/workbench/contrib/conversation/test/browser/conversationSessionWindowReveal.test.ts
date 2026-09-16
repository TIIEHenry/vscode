/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getActiveElement } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService, IConversationPartWindowSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationSessionChatContribution } from '../../browser/conversationSessionChat.contribution.js';
import { ConversationNavigationContribution } from '../../browser/conversationNavigation.contribution.js';
import { ConversationNavigationService, IConversationNavigationService } from '../../browser/conversationNavigationService.js';
import { ConversationSessionChatService, IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { ConversationSessionWindowService, IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from '../../browser/conversationEngineRosterService.js';
import type { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationEditorPaneId, conversationSessionLeafHiddenClass } from '../../common/conversationSessionWindow.js';
import { UA_CLIENT_CHAT_INPUT_AUTO_FOCUS } from '../../common/uaClientSettingsKeys.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';

declare function __readFileInTests(path: string): Promise<string>;

class QuietRosterService extends ConversationStubService {
	seedSessionQuietly(): string {
		const previous = this.model.getActiveSessionId();
		const sessionId = this.model.createSession();
		this.model.switchSession(previous);
		this._onDidChangeSession.fire(sessionId);
		return sessionId;
	}

	fireActiveSession(sessionId: string): void {
		this._onDidChangeActiveSession.fire(sessionId);
	}
}

suite('Conversation session window reveal + leaf SessionBar (C)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationReveal';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationReveal';

	installConversationLensResizeObserverHarness();

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	setup(function () {
		this.timeout(20_000);
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	function layoutParts(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			part.layout(800, 600, 0, 0);
		}
	}

	function trackEditors(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			for (const editor of part.activeGroup.editors) {
				store.add(editor);
			}
		}
	}

	async function waitForPane(part: IConversationEditorPart, openErrors: unknown[] = [], parts?: Awaited<ReturnType<typeof createEditorParts>>): Promise<ConversationEditorPane> {
		await part.whenReady;
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			const pane = part.activeGroup.activeEditorPane;
			if (pane instanceof ConversationEditorPane) {
				if (parts) {
					trackEditors(parts);
				}
				return pane;
			}
			await timeout(20);
		}
		const detail = openErrors.map(error => error instanceof Error ? error.stack ?? error.message : String(error)).join('\n');
		throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}; got ${part.activeGroup.activeEditorPane?.getId()}${detail ? `\n${detail}` : ''}`);
	}

	function partFor(parts: Awaited<ReturnType<typeof createEditorParts>>, sessionKey: string): IConversationEditorPart {
		const part = parts.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		assert.ok(part, `missing part ${sessionKey}`);
		return part;
	}

	function visibleLeafKeys(windowService: ConversationSessionWindowService): string[] {
		return [...windowService.getVisibleSessionKeys()];
	}

	function hideButton(windowService: ConversationSessionWindowService, sessionKey: string): HTMLButtonElement | null {
		return windowService.getLeafSlots(sessionKey)?.sessionBar.querySelector('.conversation-session-leaf-hide') as HTMLButtonElement | null;
	}

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void | Promise<void>): Promise<void> {
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
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
			await run();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	function createLightweightWindowHarness(options?: { delaySlots?: boolean }) {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		const onDidCreateSlots = new Emitter<IConversationPartWindowSlots>();
		store.add(onDidCreateSlots);

		let throwOnCreate = false;
		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				if (throwOnCreate) {
					throw new Error('reveal boom');
				}
				const part = { sessionKey, whenReady: Promise.resolve(), activeGroup: { focus: () => { }, activeEditorPane: { getId: () => ConversationEditorPaneId } } } as unknown as IConversationEditorPart;
				conversationParts.push(part);
				return part;
			},
			disposeConversationEditorPart: (sessionKey: string) => {
				const index = conversationParts.findIndex(part => part.sessionKey === sessionKey);
				if (index >= 0) {
					conversationParts.splice(index, 1);
				}
			},
			setFocusedConversationLeaf: () => { },
			getFocusedConversationLeaf: () => undefined,
			get conversationParts() {
				return conversationParts;
			},
		} as unknown as IEditorGroupsService;

		let onNotifyError: ((message: string | Error) => void) | undefined;
		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: onDidCreateSlots.event,
				onDidFocus: Event.None,
				getSlots: () => options?.delaySlots
					? undefined
					: { sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined },
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{
				error: (message: string | Error) => {
					onNotifyError?.(message);
				},
			} as INotificationService,
		));

		return {
			sessionWindowService,
			rosterService,
			setThrowOnCreate(value: boolean) {
				throwOnCreate = value;
			},
			setNotifyError(handler: (message: string | Error) => void) {
				onNotifyError = handler;
			},
			attachSlots() {
				onDidCreateSlots.fire({
					sessionBar: document.createElement('div'),
					sessionWindowGrid: gridHost,
					editorPartHost: undefined,
				});
			},
		};
	}

	async function collectLeafConversationLenses(part: IConversationEditorPart): Promise<ConversationLens[]> {
		const group = part.activeGroup;
		const lenses: ConversationLens[] = [];
		for (const editor of group.editors) {
			await group.openEditor(editor);
			const pane = group.activeEditorPane;
			assert.ok(pane instanceof ConversationEditorPane, `missing ConversationEditorPane for ${editor.resource}`);
			const lens = pane.activeConversationLens;
			assert.ok(lens, `each conversation tab must expose a ConversationLens (${editor.resource})`);
			lenses.push(lens);
		}
		return lenses;
	}

	function countLeafChrome(windowService: ConversationSessionWindowService, conversationPart: ConversationPart): { bars: number; navs: number; partSlotBars: number } {
		let bars = 0;
		let navs = 0;
		for (const key of windowService.getVisibleSessionKeys()) {
			const leaf = windowService.getLeafSlots(key);
			assert.ok(leaf);
			bars += leaf.container.querySelectorAll('.conversation-lens-session-bar').length;
			navs += leaf.container.querySelectorAll('.conversation-window-nav').length;
		}
		const partSlotBars = conversationPart.getSlots()?.sessionBar.querySelectorAll('.conversation-lens-session-bar').length ?? 0;
		return { bars, navs, partSlotBars };
	}

	function stubLensRuntimeServices(instantiationService: ReturnType<typeof workbenchInstantiationService>): void {
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IExplorerService, {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService);
		instantiationService.stub(ISCMService, {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService);
	}

	async function createRevealHarness() {
		const rosterService = store.add(new QuietRosterService());
		const openErrors: unknown[] = [];
		const instantiationService = workbenchInstantiationService({
			configurationService: () => new TestConfigurationService({
				workbench: { editor: { enablePreview: false } },
				[UA_CLIENT_CHAT_INPUT_AUTO_FOCUS]: false,
			}),
		}, store);
		instantiationService.stub(ILogService, {
			error: (error: unknown) => { openErrors.push(error); },
			warn: () => { },
			info: () => { },
			trace: () => { },
			debug: () => { },
			flush: () => { },
			getLevel: () => 0,
			setLevel: () => { },
			onDidChangeLogLevel: Event.None,
		} as unknown as ILogService);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubLensRuntimeServices(instantiationService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		conversationPart.create(parent);
		instantiationService.stub(IConversationPartService, conversationPart);

		const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
		instantiationService.stub(IConversationSessionChatService, sessionChatService);
		const sessionWindowService = disposables.add(instantiationService.createInstance(ConversationSessionWindowService));
		instantiationService.stub(IConversationSessionWindowService, sessionWindowService);
		const navigationService = disposables.add(instantiationService.createInstance(ConversationNavigationService));
		instantiationService.stub(IConversationNavigationService, navigationService);

		store.add(instantiationService.createInstance(ConversationSessionChatContribution));
		store.add(instantiationService.createInstance(ConversationNavigationContribution));

		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		const primaryPart = partFor(parts, primaryId);
		await waitForPane(primaryPart, openErrors, parts);
		layoutParts(parts);
		trackEditors(parts);

		return { instantiationService, parts, conversationPart, rosterService, sessionWindowService, sessionChatService, primaryId, openErrors };
	}

	async function waitForSessionPane(
		harness: Awaited<ReturnType<typeof createRevealHarness>>,
		sessionKey: string,
	): Promise<ConversationEditorPane> {
		return waitForPane(partFor(harness.parts, sessionKey), harness.openErrors, harness.parts);
	}

	test('8 single-leaf reveal A→B→A keeps one visible primary without hide button', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();

		await sessionWindowService.revealSessionWindow(b);
		const partB = partFor(parts, b);
		await waitForSessionPane(harness, b);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [b]);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
		assert.strictEqual(partB.sessionKey, b);
		assert.strictEqual(parts.getActiveConversationEditorPart()?.sessionKey, b);
		assert.ok(sessionWindowService.isSessionWindowHidden(primaryId));
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(hideButton(sessionWindowService, b)?.hidden, true);

		await sessionWindowService.revealSessionWindow(primaryId);
		await waitForSessionPane(harness, primaryId);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [primaryId]);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.strictEqual(hideButton(sessionWindowService, primaryId)?.hidden, true);
	});

	test('8 two visible leaves: reveal already-visible leaf focuses it', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId, conversationPart } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);

		await sessionWindowService.revealSessionWindow(b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
		assert.strictEqual(rosterService.getActiveSessionId(), b);
		assert.strictEqual(parts.getActiveConversationEditorPart()?.sessionKey, b);
		const leafB = sessionWindowService.getLeafSlots(b);
		assert.ok(leafB);
		const active = getActiveElement();
		assert.ok(
			leafB.container === active || leafB.container.contains(active),
			'focus must stay in the revealed leaf, not snap back to primary',
		);
		const chrome = countLeafChrome(sessionWindowService, conversationPart);
		assert.strictEqual(chrome.bars, 2);
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(partFor(parts, b).sessionKey, b);
	});

	test('10 SelectBox path on real pane changes the leaf (PRD-002 #1)', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const pane = await waitForSessionPane(harness, primaryId);
		assert.ok(pane.leafSessionBarHost);
		await pane.leafSessionBarHost!.switchLeafSession(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.ok(partFor(parts, b).activeGroup.activeEditor);
	});

	test('10 two visible leaves: SelectBox on one leaf replaces that leaf with a third session', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const c = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		const paneB = await waitForSessionPane(harness, b);
		assert.ok(paneB.leafSessionBarHost);
		await paneB.leafSessionBarHost!.switchLeafSession(c);
		await waitForSessionPane(harness, c);
		const visible = visibleLeafKeys(sessionWindowService);
		assert.strictEqual(visible.length, 2);
		assert.ok(visible.includes(primaryId), 'the other leaf must stay');
		assert.ok(visible.includes(c), 'the operated leaf must become the third session');
		assert.ok(!visible.includes(b), 'the operated leaf must not remain');
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(partFor(parts, c).sessionKey, c);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(b), true);
	});

	test('does not leak unhandled rejection when switchToSession switchLeafSession rejects and onUnexpectedError warn-then-rethrows', async () => {
		const harness = await createRevealHarness();
		const pane = await waitForSessionPane(harness, harness.primaryId);
		assert.ok(pane.leafSessionBarHost);
		const paintBoom = new Error('switch boom');
		pane.leafSessionBarHost.switchLeafSession = async () => {
			throw paintBoom;
		};
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			pane.leafSessionBarHost!.switchToSession('other-session');
		});
	});

	test('10 New Session in stub path becomes the only visible leaf', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, rosterService, primaryId } = harness;
		const pane = await waitForSessionPane(harness, primaryId);
		assert.ok(pane.leafSessionBarHost);
		pane.leafSessionBarHost!.createNewSession();
		const deadline = Date.now() + 3000;
		let newId = rosterService.getActiveSessionId();
		while (newId === primaryId && Date.now() < deadline) {
			await timeout(20);
			newId = rosterService.getActiveSessionId();
		}
		assert.notStrictEqual(newId, primaryId);
		await waitForSessionPane(harness, newId);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), newId);
		assert.strictEqual(hideButton(sessionWindowService, newId)?.hidden, true);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
	});

	test('13 each visible leaf has exactly one SessionBar and window-nav; Part slot has none', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, rosterService, conversationPart, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const c = rosterService.seedSessionQuietly();

		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		await sessionWindowService.revealSessionWindow(c);
		await waitForSessionPane(harness, c);
		await sessionWindowService.revealSessionWindow(primaryId);
		await waitForSessionPane(harness, primaryId);
		let chrome = countLeafChrome(sessionWindowService, conversationPart);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.strictEqual(chrome.bars, 1);
		assert.strictEqual(chrome.navs, 1);
		assert.strictEqual(chrome.partSlotBars, 0);

		await sessionWindowService.openSessionBeside(b);
		await waitForSessionPane(harness, b);
		chrome = countLeafChrome(sessionWindowService, conversationPart);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(chrome.bars, 2);
		assert.strictEqual(chrome.navs, 2);
		assert.strictEqual(chrome.partSlotBars, 0);
	});

	test('14 reveal mounts overlay so openSubAgent does not throw', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, sessionChatService, rosterService } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		await sessionChatService.openSubAgent(b, 'tool-from-reveal', 'Reveal tool');
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(b), true);
	});

	test('15 latest-wins reveal ends on B; bind-failed sentinel does not create a leaf', async () => {
		const { sessionWindowService, rosterService, primaryId } = await createRevealHarness();
		const a = rosterService.seedSessionQuietly();
		const b = rosterService.seedSessionQuietly();
		const first = sessionWindowService.revealSessionWindow(a);
		const second = sessionWindowService.revealSessionWindow(b);
		await Promise.all([first, second]);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [b]);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);

		const keysBefore = [...sessionWindowService.getAllLeafSessionKeys()];
		rosterService.fireActiveSession(ENGINE_BIND_FAILED_SESSION_ID);
		await timeout(20);
		assert.deepStrictEqual([...sessionWindowService.getAllLeafSessionKeys()], keysBefore);
		assert.strictEqual(sessionWindowService.getLeafSlots(ENGINE_BIND_FAILED_SESSION_ID), undefined);
		assert.ok(sessionWindowService.getLeafSlots(primaryId) || sessionWindowService.getLeafSlots(b));
	});

	test('15 stub-seed untitled onDidChangeActiveSession still reveals', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, rosterService } = harness;
		assert.ok(isEngineRosterPlaceholderSessionId('untitled'));
		assert.ok(rosterService.getSessions().some(session => session.id === 'untitled'));
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden('untitled'), true);

		rosterService.fireActiveSession('untitled');
		await waitForSessionPane(harness, 'untitled');
		assert.strictEqual(sessionWindowService.isSessionWindowVisible('untitled'), true);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), ['untitled']);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), 'untitled');
	});

	test('15 reveal create failure rolls back part + leaf and rebuilds the same key', async () => {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		const conversationParts: IConversationEditorPart[] = [];
		let throwOnCreate = false;
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				if (throwOnCreate) {
					throw new Error('reveal boom');
				}
				const part = { sessionKey, whenReady: Promise.resolve(), activeGroup: { focus: () => { }, activeEditorPane: { getId: () => ConversationEditorPaneId } } } as unknown as IConversationEditorPart;
				conversationParts.push(part);
				return part;
			},
			disposeConversationEditorPart: (sessionKey: string) => {
				const index = conversationParts.findIndex(part => part.sessionKey === sessionKey);
				if (index >= 0) {
					conversationParts.splice(index, 1);
				}
			},
			setFocusedConversationLeaf: () => { },
			getFocusedConversationLeaf: () => undefined,
			get conversationParts() {
				return conversationParts;
			},
		} as unknown as IEditorGroupsService;

		const errors: string[] = [];
		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{
				error: (message: string | Error) => {
					errors.push(typeof message === 'string' ? message : getErrorMessage(message));
				},
			} as INotificationService,
		));

		await timeout(0);
		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		const target = rosterService.seedSessionQuietly();
		throwOnCreate = true;
		await sessionWindowService.revealSessionWindow(target);

		assert.ok(errors.some(error => error.includes('reveal boom')));
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.strictEqual(sessionWindowService.getLeafSlots(target), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(target));
		assert.ok(!conversationParts.some(part => part.sessionKey === target));

		throwOnCreate = false;
		await sessionWindowService.revealSessionWindow(target);
		assert.ok(sessionWindowService.getLeafSlots(target));
		assert.ok(conversationParts.some(part => part.sessionKey === target));
		assert.ok(sessionWindowService.getLeafSlots(target)?.container.isConnected);
	});

	test('17 hiding a leaf releases its lens lease and restore reacquires it', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId, sessionChatService } = harness;
		await sessionChatService.openExtensionTab(primaryId, 'fork-lease', { title: 'Fork lease' });
		const paneA = await waitForSessionPane(harness, primaryId);
		const partA = partFor(parts, primaryId);
		const tabCount = partA.activeGroup.count;
		assert.ok(tabCount >= 2);
		assert.ok(paneA.activeConversationLens);

		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
		assert.strictEqual(partA.activeGroup.count, tabCount);
		const hiddenLenses = await collectLeafConversationLenses(partA);
		assert.strictEqual(hiddenLenses.length, tabCount);
		for (const lens of hiddenLenses) {
			assert.strictEqual(lens.sessionViewLease, undefined);
		}
		assert.strictEqual(partA.sessionKey, primaryId);
		const hiddenLeaf = sessionWindowService.getLeafSlots(primaryId)?.container;
		assert.ok(hiddenLeaf?.classList.contains(conversationSessionLeafHiddenClass));
		const staleBanner = hiddenLeaf?.querySelector('.conversation-lens-stale-snapshot') as HTMLElement | null;
		assert.ok(!staleBanner || staleBanner.hidden || !staleBanner.textContent);

		await sessionWindowService.revealSessionWindow(primaryId);
		const paneA2 = await waitForSessionPane(harness, primaryId);
		const restoredLenses = await collectLeafConversationLenses(partFor(parts, primaryId));
		assert.strictEqual(restoredLenses.length, tabCount);
		for (const lens of restoredLenses) {
			assert.ok(lens.sessionViewLease, 'restore must reacquire sessionViewLease on every leaf lens');
		}
		assert.ok(paneA2.activeConversationLens?.sessionViewLease, 'restore must reacquire sessionViewLease');
	});

	test('does not leak unhandled rejection when onDidChangeActiveSession reveal catch-path notice throws and onUnexpectedError warn-then-rethrows', async () => {
		// revealSessionWindow already catches create throw; a lone inner reject does not leak.
		// The void onDidChangeActiveSession call site still needs `.catch` when the catch-path notice throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const harness = createLightweightWindowHarness();
		await timeout(0);
		const primaryId = harness.rosterService.getActiveSessionId();
		await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
		const target = harness.rosterService.seedSessionQuietly();
		harness.setThrowOnCreate(true);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			harness.setNotifyError(() => {
				throw paintBoom;
			});
			harness.rosterService.fireActiveSession(target);
		});
	});

	test('does not leak unhandled rejection when attachGrid pending reveal catch-path notice throws and onUnexpectedError warn-then-rethrows', async () => {
		// revealSessionWindow already catches create throw; a lone inner reject does not leak.
		// The void attachGrid pending call site still needs `.catch` when the catch-path notice throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const harness = createLightweightWindowHarness({ delaySlots: true });
		const target = harness.rosterService.seedSessionQuietly();
		harness.setThrowOnCreate(true);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			harness.setNotifyError(() => {
				throw paintBoom;
			});
			void harness.sessionWindowService.revealSessionWindow(target, { replace: harness.rosterService.getActiveSessionId() });
			harness.attachSlots();
		});
	});

	test('session window fire-and-forget voids double-catch onUnexpectedError', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts`);
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`void this.revealSessionWindow(sessionKey)${doubleCatch}`));
		assert.ok(source.includes(`void this.revealSessionWindow(pending.sessionKey, pending.options)${doubleCatch}`));
		assert.ok(source.includes(`void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId())${doubleCatch}`));
		assert.ok(!source.includes('void this.revealSessionWindow(sessionKey);'));
		assert.ok(!source.includes('void this.revealSessionWindow(pending.sessionKey, pending.options);'));
		assert.ok(!source.includes('void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId());'));
	});
});
