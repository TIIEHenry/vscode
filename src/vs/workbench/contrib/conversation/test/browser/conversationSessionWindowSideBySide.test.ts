/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { IEditorPaneRegistry } from '../../../../browser/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationSessionChatService, IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { conversationSessionLeafHiddenClass } from '../../common/conversationSessionWindow.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';

class QuietRosterService extends ConversationStubService {
	seedSessionQuietly(): string {
		const previous = this.model.getActiveSessionId();
		const sessionId = this.model.createSession();
		this.model.switchSession(previous);
		this._onDidChangeSession.fire(sessionId);
		return sessionId;
	}
}

suite('Conversation session window side-by-side (S5)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationSideBySide';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationSideBySide';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	function layoutConversationEditorParts(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			part.layout(800, 600, 0, 0);
		}
	}

	function trackConversationEditors(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			for (const editor of part.activeGroup.editors) {
				store.add(editor);
			}
		}
	}

	function isConversationEditorPaneRegistered(): boolean {
		const registry = Registry.as<IEditorPaneRegistry & { getEditorPaneByType?(typeId: string): { typeId: string } | undefined }>(EditorExtensions.EditorPane);
		return !!registry.getEditorPaneByType?.(ConversationEditorPane.ID);
	}

	async function settleConversationEditors(parts: Awaited<ReturnType<typeof createEditorParts>>): Promise<void> {
		if (isConversationEditorPaneRegistered()) {
			const deadline = Date.now() + 2000;
			while (Date.now() < deadline) {
				const list = parts.conversationParts;
				if (list.length > 0 && list.every(part => {
					const pane = part.activeGroup.activeEditorPane;
					return pane instanceof ConversationEditorPane && !!pane.activeConversationLens;
				})) {
					break;
				}
				await timeout(20);
			}
		}
		layoutConversationEditorParts(parts);
		trackConversationEditors(parts);
	}

	async function createHarness() {
		const rosterService = new QuietRosterService();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
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
		store.add(rosterService);

		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		await settleConversationEditors(parts);

		return { parts, conversationPart, rosterService, sessionWindowService, sessionChatService, primaryId };
	}

	async function createSideBySideHarness() {
		const harness = await createHarness();
		const secondaryId = harness.rosterService.seedSessionQuietly();

		await harness.sessionWindowService.openSessionBeside(secondaryId);
		await settleConversationEditors(harness.parts);

		return { ...harness, secondaryId };
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

	function createPrimaryBootstrapHarness() {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		let throwOnCreate = true;
		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				if (throwOnCreate) {
					throw new Error('primary bootstrap boom');
				}
				const part = { sessionKey, whenReady: Promise.resolve() } as IConversationEditorPart;
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

		return {
			sessionWindowService,
			rosterService,
			gridHost,
			errors,
			primaryId: rosterService.getActiveSessionId(),
			setThrowOnCreate(value: boolean) {
				throwOnCreate = value;
			},
		};
	}

	test('openSessionBeside creates two conversation editor parts in two leaves', async () => {
		const { parts, sessionWindowService, primaryId, secondaryId } = await createSideBySideHarness();

		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(parts.conversationParts.length, 2);
		assert.ok(parts.conversationParts.some(part => part.sessionKey === primaryId));
		assert.ok(parts.conversationParts.some(part => part.sessionKey === secondaryId));
	});

	test('two session windows share one preview editor part', async () => {
		const { parts, sessionWindowService } = await createSideBySideHarness();

		assert.strictEqual(parts.conversationParts.length, 2);
		assert.ok(parts.mainPart.groups.length >= 1);
		assert.strictEqual(parts.parts.filter(part => part === parts.mainPart).length, 1);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
	});

	test('hide second session window leaves one visible leaf and preserves editor model', async () => {
		const { parts, sessionWindowService, secondaryId } = await createSideBySideHarness();
		const secondaryPart = parts.conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(secondaryPart);
		const editorsBefore = secondaryPart.activeGroup.count;

		sessionWindowService.hideSessionWindow(secondaryId);

		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(secondaryId), true);
		assert.strictEqual(parts.conversationParts.length, 2);
		assert.strictEqual(secondaryPart.activeGroup.count, editorsBefore);

		const leaf = sessionWindowService.getLeafSlots(secondaryId);
		assert.ok(leaf?.container.classList.contains(conversationSessionLeafHiddenClass));
	});

	test('restore hidden session window shows side-by-side layout again', async () => {
		const { sessionWindowService, secondaryId } = await createSideBySideHarness();

		sessionWindowService.hideSessionWindow(secondaryId);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);

		sessionWindowService.restoreSessionWindow(secondaryId);

		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
		const leaf = sessionWindowService.getLeafSlots(secondaryId);
		assert.ok(leaf);
		assert.ok(!leaf.container.classList.contains(conversationSessionLeafHiddenClass));
	});

	test('openSessionBeside on hidden session restores without creating a third part', async () => {
		const { parts, sessionWindowService, secondaryId } = await createSideBySideHarness();

		sessionWindowService.hideSessionWindow(secondaryId);
		await sessionWindowService.openSessionBeside(secondaryId);

		assert.strictEqual(parts.conversationParts.length, 2);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
	});

	test('splitSessionWindow targets a specific parallel session part by session key', async () => {
		const { parts, sessionChatService, primaryId, secondaryId } = await createSideBySideHarness();
		const primaryPart = parts.conversationParts.find(part => part.sessionKey === primaryId);
		const secondaryPart = parts.conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(primaryPart);
		assert.ok(secondaryPart);

		await sessionChatService.splitSessionWindow(secondaryId);

		assert.strictEqual(secondaryPart.groups.length, 2);
		assert.strictEqual(primaryPart.groups.length, 1);
	});

	test('ConversationPart.layout fans leaf host size to each conversation editor part', async () => {
		const { conversationPart, parts, sessionWindowService, primaryId, secondaryId } = await createSideBySideHarness();
		const primaryEditor = parts.conversationParts.find(part => part.sessionKey === primaryId);
		const secondaryEditor = parts.conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(primaryEditor);
		assert.ok(secondaryEditor);
		assert.strictEqual(primaryEditor.contentDimension.width, 800);
		assert.strictEqual(primaryEditor.contentDimension.height, 600);

		const resized = { width: 640, height: 480 };
		for (const sessionKey of [primaryId, secondaryId]) {
			const host = sessionWindowService.getLeafSlots(sessionKey)?.editorPartHost;
			assert.ok(host);
			Object.defineProperty(host, 'clientWidth', { configurable: true, get: () => resized.width });
			Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => resized.height });
		}

		conversationPart.layout(1280, 502, 0, 0);

		assert.strictEqual(primaryEditor.contentDimension.width, resized.width);
		assert.strictEqual(primaryEditor.contentDimension.height, resized.height);
		assert.strictEqual(secondaryEditor.contentDimension.width, resized.width);
		assert.strictEqual(secondaryEditor.contentDimension.height, resized.height);
	});

	test('ensurePrimaryWindow createConversationEditorPart throw does not stick a half primary', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const harness = createPrimaryBootstrapHarness();
			void harness.sessionWindowService.ensurePrimaryWindow(harness.primaryId);
			await timeout(0);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(harness.errors, ['primary bootstrap boom']);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), undefined);
			assert.strictEqual(harness.sessionWindowService.getAllLeafSessionKeys().length, 0);
			assert.strictEqual(harness.sessionWindowService.getLeafSlots(harness.primaryId), undefined);
			assert.strictEqual(harness.gridHost.querySelector('.conversation-session-leaf'), null);

			harness.setThrowOnCreate(false);
			await harness.sessionWindowService.ensurePrimaryWindow(harness.primaryId);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(harness.errors, ['primary bootstrap boom']);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), harness.primaryId);
			assert.ok(harness.sessionWindowService.getLeafSlots(harness.primaryId));
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 1);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('openSessionBeside createConversationEditorPart throw does not stick a half secondary', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const harness = createPrimaryBootstrapHarness();
			await timeout(0);
			harness.setThrowOnCreate(false);
			await harness.sessionWindowService.ensurePrimaryWindow(harness.primaryId);

			const secondaryId = harness.rosterService.seedSessionQuietly();
			harness.setThrowOnCreate(true);
			void harness.sessionWindowService.openSessionBeside(secondaryId);
			await timeout(0);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(harness.errors, ['primary bootstrap boom', 'primary bootstrap boom']);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), harness.primaryId);
			assert.ok(harness.sessionWindowService.getLeafSlots(harness.primaryId));
			assert.strictEqual(harness.sessionWindowService.getLeafSlots(secondaryId), undefined);
			assert.deepStrictEqual(harness.sessionWindowService.getAllLeafSessionKeys(), [harness.primaryId]);
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 1);
			assert.strictEqual(harness.gridHost.querySelector('.conversation-session-leaf-secondary'), null);
			assert.ok(harness.gridHost.querySelector('.conversation-session-leaf-primary'));

			harness.setThrowOnCreate(false);
			await harness.sessionWindowService.openSessionBeside(secondaryId);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(harness.errors, ['primary bootstrap boom', 'primary bootstrap boom']);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), harness.primaryId);
			assert.ok(harness.sessionWindowService.getLeafSlots(harness.primaryId));
			assert.ok(harness.sessionWindowService.getLeafSlots(secondaryId));
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 2);
			assert.ok(harness.gridHost.querySelector('.conversation-session-leaf-secondary'));
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('openSessionBeside max-leaves throw restores the evicted secondary', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const harness = createPrimaryBootstrapHarness();
			await timeout(0);
			harness.setThrowOnCreate(false);
			await harness.sessionWindowService.ensurePrimaryWindow(harness.primaryId);

			const secondaryId = harness.rosterService.seedSessionQuietly();
			await harness.sessionWindowService.openSessionBeside(secondaryId);

			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 2);
			assert.ok(harness.sessionWindowService.getLeafSlots(secondaryId));
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(secondaryId), true);

			const thirdId = harness.rosterService.seedSessionQuietly();
			harness.setThrowOnCreate(true);
			void harness.sessionWindowService.openSessionBeside(thirdId);
			await timeout(0);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(harness.errors, ['primary bootstrap boom', 'primary bootstrap boom']);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), harness.primaryId);
			assert.ok(harness.sessionWindowService.getLeafSlots(harness.primaryId));
			assert.ok(harness.sessionWindowService.getLeafSlots(secondaryId));
			assert.strictEqual(harness.sessionWindowService.getLeafSlots(thirdId), undefined);
			assert.deepStrictEqual(harness.sessionWindowService.getAllLeafSessionKeys(), [harness.primaryId, secondaryId]);
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 2);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(secondaryId), true);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden(secondaryId), false);
			assert.strictEqual(harness.gridHost.querySelectorAll('.conversation-session-leaf').length, 2);
			assert.strictEqual(harness.gridHost.querySelectorAll('.conversation-session-leaf-secondary').length, 1);
			assert.ok(!harness.sessionWindowService.getLeafSlots(secondaryId)?.container.classList.contains(conversationSessionLeafHiddenClass));

			harness.setThrowOnCreate(false);
			await harness.sessionWindowService.openSessionBeside(thirdId);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.ok(harness.sessionWindowService.getLeafSlots(thirdId));
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 2);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(harness.primaryId), true);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(thirdId), true);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden(secondaryId), true);
			assert.ok(harness.gridHost.querySelector(`[data-session-key="${thirdId}"]`));
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('openSessionBeside after swallowed primary failure does not create a secondary', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const harness = createPrimaryBootstrapHarness();
			await timeout(0);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), undefined);

			const otherId = harness.rosterService.seedSessionQuietly();
			harness.setThrowOnCreate(true);
			void harness.sessionWindowService.openSessionBeside(otherId);
			await timeout(0);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.ok(harness.errors.includes('primary bootstrap boom'));
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), undefined);
			assert.strictEqual(harness.sessionWindowService.getLeafSlots(harness.primaryId), undefined);
			assert.strictEqual(harness.sessionWindowService.getLeafSlots(otherId), undefined);
			assert.deepStrictEqual(harness.sessionWindowService.getAllLeafSessionKeys(), []);
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 0);
			assert.strictEqual(harness.gridHost.querySelector('.conversation-session-leaf'), null);
			assert.strictEqual(harness.gridHost.querySelector('.conversation-session-leaf-primary'), null);
			assert.strictEqual(harness.gridHost.querySelector('.conversation-session-leaf-secondary'), null);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when attachGrid ensurePrimaryWindow catch-path notice throws and onUnexpectedError warn-then-rethrows', async () => {
		// ensurePrimaryWindow already catches create throw; a lone inner reject does not leak.
		// The void attachGrid call site still needs `.catch` when the catch-path notice throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			const rosterService = store.add(new QuietRosterService());
			const gridHost = document.createElement('div');
			document.body.appendChild(gridHost);
			store.add({ dispose: () => gridHost.remove() });
			store.add(new ConversationSessionWindowService(
				{
					onDidCreateSlots: Event.None,
					onDidFocus: Event.None,
					getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
					setFocusedLeafContainer: () => { },
					focus: () => { },
				} as unknown as IConversationPartService,
				{
					createConversationEditorPart: () => {
						throw new Error('primary bootstrap boom');
					},
					disposeConversationEditorPart: () => { },
					setFocusedConversationLeaf: () => { },
					getFocusedConversationLeaf: () => undefined,
					get conversationParts() {
						return [];
					},
				} as unknown as IEditorGroupsService,
				rosterService,
				new NullLogService(),
				{
					error: () => {
						throw paintBoom;
					},
				} as unknown as INotificationService,
			));
		});
	});
});
