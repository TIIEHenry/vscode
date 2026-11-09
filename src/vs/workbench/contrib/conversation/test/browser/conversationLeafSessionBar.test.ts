/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getActiveElement } from '../../../../../base/browser/dom.js';
import { timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
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
import { addComposerContextRef } from '../../browser/conversationComposerAt.js';
import { applyComposerSurfaceText, composeConversationPayload } from '../../browser/conversationComposerRefs.js';
import { switchToSession } from '../../browser/conversationLensSessionBar.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { IConversationWorkRootMount } from '../../browser/conversationWorkRootMount.js';
import { UA_CLIENT_CHAT_INPUT_AUTO_FOCUS } from '../../common/uaClientSettingsKeys.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
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

class RefusingDeleteRosterService extends QuietRosterService {
	override deleteSession(_sessionId: string): boolean {
		return false;
	}
}

/**
 * Delete hides the session; `rollback` brings it back with a session change only.
 * A real engine rollback that had moved the active id fires an active-session change
 * first. This fixture covers only the session-change path.
 */
class RollbackDeleteRosterService extends QuietRosterService {
	private hidden: string | undefined;

	override getSessions() {
		return super.getSessions().filter(session => session.id !== this.hidden);
	}

	override deleteSession(sessionId: string): boolean {
		this.hidden = sessionId;
		return true;
	}

	rollback(sessionId: string): void {
		this.hidden = undefined;
		this._onDidChangeSession.fire(sessionId);
	}
}

suite('ConversationLeafSessionBar', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationLeafSessionBar';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationLeafSessionBar';

	installConversationLensResizeObserverHarness();

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

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
		throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}`);
	}

	async function waitForCondition(condition: () => boolean, label: string): Promise<void> {
		const deadline = Date.now() + 3000;
		while (!condition()) {
			if (Date.now() >= deadline) {
				throw new Error(`timed out waiting for ${label}`);
			}
			await timeout(20);
		}
	}

	function partFor(parts: Awaited<ReturnType<typeof createEditorParts>>, sessionKey: string): IConversationEditorPart {
		const part = parts.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		assert.ok(part, `missing part ${sessionKey}`);
		return part;
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
		instantiationService.stub(IConversationWorkRootMount, {
			_serviceBrand: undefined,
			onDidChangeOffer: Event.None,
			getOffer: () => undefined,
			setOffer: () => { },
			acceptOffer: async () => { },
		});
	}

	async function createHarness(roster?: QuietRosterService) {
		const rosterService = store.add(roster ?? new QuietRosterService());
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
		await waitForPane(partFor(parts, primaryId), openErrors, parts);
		layoutParts(parts);
		trackEditors(parts);

		return { parts, rosterService, sessionWindowService, primaryId };
	}

	test('two visible leaves: switching to the other visible session focuses it without replace', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		const paneA = await waitForPane(partFor(parts, primaryId));
		const paneB = await waitForPane(partFor(parts, b));
		assert.ok(paneA.leafSessionBarHost);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);

		const replaceArgs: (string | undefined)[] = [];
		const originalReveal = sessionWindowService.revealSessionWindow.bind(sessionWindowService);
		sessionWindowService.revealSessionWindow = async (sessionId, options) => {
			replaceArgs.push(options?.replace);
			return originalReveal(sessionId, options);
		};

		await paneA.leafSessionBarHost!.switchLeafSession(b);

		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
		assert.strictEqual(rosterService.getActiveSessionId(), b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.ok(sessionWindowService.isSessionWindowVisible(primaryId));
		assert.ok(sessionWindowService.isSessionWindowVisible(b));
		assert.ok(!sessionWindowService.isSessionWindowHidden(b));
		assert.deepStrictEqual(replaceArgs, [undefined]);
		const leafB = sessionWindowService.getLeafSlots(b);
		assert.ok(leafB);
		const active = getActiveElement();
		assert.ok(
			leafB.container === active || leafB.container.contains(active),
			'focus must land in the other visible leaf',
		);
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(partFor(parts, b).sessionKey, b);
		assert.ok(paneB.leafSessionBarHost);
	});

	test('focusin on another leaf calls switchSession once when the roster keeps the old active id', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		await waitForPane(partFor(parts, primaryId));
		await waitForPane(partFor(parts, b));
		await sessionWindowService.revealSessionWindow(b);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
		assert.strictEqual(rosterService.getActiveSessionId(), b);

		const switched: string[] = [];
		rosterService.switchSession = (sessionId: string) => {
			switched.push(sessionId);
		};
		const leafA = sessionWindowService.getLeafSlots(primaryId);
		assert.ok(leafA);
		leafA.container.dispatchEvent(new FocusEvent('focusin'));

		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		assert.deepStrictEqual(switched, [primaryId]);
	});

	test('switchLeafSession does not call switchSession when the active id is already the target', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		await waitForPane(partFor(parts, primaryId));
		const paneB = await waitForPane(partFor(parts, b));
		assert.ok(paneB.leafSessionBarHost);
		await sessionWindowService.revealSessionWindow(b);
		assert.strictEqual(rosterService.getActiveSessionId(), b);

		const switched: string[] = [];
		const originalSwitch = rosterService.switchSession.bind(rosterService);
		rosterService.switchSession = (sessionId: string) => {
			switched.push(sessionId);
			originalSwitch(sessionId);
		};
		await paneB.leafSessionBarHost.switchLeafSession(b);

		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
		assert.deepStrictEqual(switched, []);
	});

	test('switchLeafSession switches to its argument when reveal does not focus a leaf', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const paneA = await waitForPane(partFor(parts, primaryId));
		assert.ok(paneA.leafSessionBarHost);
		assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
		sessionWindowService.revealSessionWindow = async () => ({ cancelled: false });

		const switched: string[] = [];
		const originalSwitch = rosterService.switchSession.bind(rosterService);
		rosterService.switchSession = (sessionId: string) => {
			switched.push(sessionId);
			originalSwitch(sessionId);
		};
		await paneA.leafSessionBarHost.switchLeafSession(b);

		assert.deepStrictEqual(switched, [b]);
		assert.strictEqual(rosterService.getActiveSessionId(), b);
	});

	test('leaf session bar title follows roster rename while that leaf is not active', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		await waitForPane(partFor(parts, primaryId));
		await waitForPane(partFor(parts, b));
		const leafSlots = sessionWindowService.getLeafSlots(b);
		assert.ok(leafSlots);
		const titleButton = leafSlots.sessionBar.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleLive = leafSlots.sessionBar.querySelector('.conversation-lens-session-title-live') as HTMLElement;
		assert.ok(titleButton);
		assert.ok(titleLive);
		const beforeTitle = rosterService.getSessions().find(s => s.id === b)!.title;
		assert.strictEqual(titleButton.textContent, beforeTitle);

		assert.strictEqual(rosterService.renameSession(b, 'Renamed beside leaf'), true);

		assert.strictEqual(titleButton.textContent, 'Renamed beside leaf');
		assert.strictEqual(titleLive.textContent, 'Renamed beside leaf');
	});

	test('ConversationLeafSessionBar clears and detaches bar on dispose', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		layoutParts(parts);
		await waitForPane(partFor(parts, primaryId));
		const paneB = await waitForPane(partFor(parts, b));
		const leafSlots = sessionWindowService.getLeafSlots(b);
		assert.ok(leafSlots);
		assert.ok(leafSlots.sessionBar.querySelector('.conversation-lens-session-bar'));
		assert.ok(paneB.leafSessionBarHost);

		paneB.leafSessionBarHost.dispose();
		assert.strictEqual(leafSlots.sessionBar.querySelector('.conversation-lens-session-bar'), null);
	});

	test('two visible leaves: focus moving to the other window and back keeps a turn edit', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const userTurn = rosterService.appendUserTurn(primaryId, 'Edit me');
		assert.ok(userTurn);
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		const paneA = await waitForPane(partFor(parts, primaryId));
		await waitForPane(partFor(parts, b), [], parts);
		const lens = paneA.activeConversationLens;
		assert.ok(lens);
		lens.beginTurnEdit(userTurn.id);
		assert.strictEqual(lens.composerModel.policy, 'turnEdit');
		lens.dockTextarea.value = 'Edit me, changed';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		const leafA = sessionWindowService.getLeafSlots(primaryId);
		const leafB = sessionWindowService.getLeafSlots(b);
		assert.ok(leafA);
		assert.ok(leafB);

		leafB.container.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		assert.strictEqual(rosterService.getActiveSessionId(), b);
		leafA.container.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		assert.strictEqual(rosterService.getActiveSessionId(), primaryId);

		assert.strictEqual(lens.composerModel.policy, 'turnEdit');
		assert.strictEqual(lens.composerModel.editingTurnId, userTurn.id);
		assert.strictEqual(lens.dockTextarea.value, 'Edit me, changed');
	});

	test('switching away through the leaf session bar ends a turn edit when the leaf hides', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const userTurn = rosterService.appendUserTurn(primaryId, 'Edit me');
		assert.ok(userTurn);
		const b = rosterService.seedSessionQuietly();
		const paneA = await waitForPane(partFor(parts, primaryId));
		const lens = paneA.activeConversationLens;
		const leafBarA = paneA.leafSessionBarHost;
		assert.ok(lens);
		assert.ok(leafBarA);
		lens.dockTextarea.value = 'compose draft';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		lens.beginTurnEdit(userTurn.id);
		assert.strictEqual(lens.composerModel.policy, 'turnEdit');
		lens.dockTextarea.value = 'Edit me, changed';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));

		switchToSession(leafBarA, b);
		await waitForCondition(() => sessionWindowService.getFocusedLeafSessionKey() === b, 'focus in the new leaf');
		const paneB = await waitForPane(partFor(parts, b), [], parts);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
		assert.strictEqual(lens.composerModel.policy, 'compose', 'hiding the leaf ends the edit');
		assert.strictEqual(lens.dockTextarea.value, 'compose draft');

		const leafBarB = paneB.leafSessionBarHost;
		assert.ok(leafBarB);
		switchToSession(leafBarB, primaryId);
		await waitForCondition(() => sessionWindowService.getFocusedLeafSessionKey() === primaryId, 'focus back in the first leaf');

		assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.strictEqual(paneA.activeConversationLens, lens);
		assert.strictEqual(lens.composerModel.policy, 'compose');
		assert.strictEqual(lens.dockTextarea.value, 'compose draft');
	});

	test('leaf session bar switch keeps the composer refs in the outgoing draft', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const paneA = await waitForPane(partFor(parts, primaryId));
		const lens = paneA.activeConversationLens;
		const leafBar = paneA.leafSessionBarHost;
		assert.ok(lens);
		assert.ok(leafBar);
		const ref = getConversationChatResource(b, 'default').toString();
		addComposerContextRef(lens, ref);
		lens.dockTextarea.value = 'body with a ref';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));

		switchToSession(leafBar, b);
		assert.strictEqual(lens.readComposerDraft(primaryId), composeConversationPayload('body with a ref', [ref]));
		await waitForCondition(() => sessionWindowService.getFocusedLeafSessionKey() === b, 'focus in the new leaf');
		await waitForPane(partFor(parts, b), [], parts);

		// Restore from the draft the leaf bar wrote, not from chips still held in memory.
		applyComposerSurfaceText(lens, '');
		lens.restoreComposerDraftToInput();
		assert.deepStrictEqual([...lens.composerRefResources], [ref]);
		assert.strictEqual(lens.dockTextarea.value, 'body with a ref');
	});

	test('leaf session bar new session keeps the composer refs in the outgoing draft', async () => {
		const harness = await createHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const paneA = await waitForPane(partFor(parts, primaryId));
		const lens = paneA.activeConversationLens;
		const leafBar = paneA.leafSessionBarHost;
		assert.ok(lens);
		assert.ok(leafBar);
		const ref = getConversationChatResource(b, 'default').toString();
		addComposerContextRef(lens, ref);
		lens.dockTextarea.value = 'body with a ref';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));

		leafBar.createNewSession();
		assert.strictEqual(lens.readComposerDraft(primaryId), composeConversationPayload('body with a ref', [ref]));
		const created = rosterService.getActiveSessionId();
		assert.notStrictEqual(created, primaryId);
		await waitForCondition(() => sessionWindowService.getFocusedLeafSessionKey() === created, 'focus in the new session leaf');
		await waitForPane(partFor(parts, created), [], parts);
	});

	test('leaf session bar refused delete keeps the composer refs in the draft and on the lens', async () => {
		const harness = await createHarness(new RefusingDeleteRosterService());
		const { parts, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const paneA = await waitForPane(partFor(parts, primaryId));
		const lens = paneA.activeConversationLens;
		const leafBar = paneA.leafSessionBarHost;
		assert.ok(lens);
		assert.ok(leafBar);
		const ref = getConversationChatResource(b, 'default').toString();
		addComposerContextRef(lens, ref);
		lens.dockTextarea.value = 'body with a ref';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		leafBar.dialogService.confirm = async () => ({ confirmed: true });

		await leafBar.deleteActiveSession();

		assert.strictEqual(lens.readComposerDraft(primaryId), composeConversationPayload('body with a ref', [ref]));
		assert.deepStrictEqual([...lens.composerRefResources], [ref]);
		assert.strictEqual(lens.composerRefRow.hidden, false);
	});

	test('leaf session bar delete rollback restores the composer refs on the lens', async () => {
		const roster = new RollbackDeleteRosterService();
		const harness = await createHarness(roster);
		const { parts, primaryId } = harness;
		const b = roster.seedSessionQuietly();
		const paneA = await waitForPane(partFor(parts, primaryId));
		const lens = paneA.activeConversationLens;
		const leafBar = paneA.leafSessionBarHost;
		assert.ok(lens);
		assert.ok(leafBar);
		const ref = getConversationChatResource(b, 'default').toString();
		addComposerContextRef(lens, ref);
		lens.dockTextarea.value = 'body with a ref';
		lens.dockTextarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		leafBar.dialogService.confirm = async () => ({ confirmed: true });

		await leafBar.deleteActiveSession();
		// The user drops the chip while the delete is still pending.
		applyComposerSurfaceText(lens, 'body with a ref');
		assert.deepStrictEqual([...lens.composerRefResources], []);
		roster.rollback(primaryId);

		assert.deepStrictEqual([...lens.composerRefResources], [ref]);
		assert.strictEqual(lens.dockTextarea.value, 'body with a ref');
		assert.strictEqual(lens.readComposerDraft(primaryId), composeConversationPayload('body with a ref', [ref]));
	});
});
