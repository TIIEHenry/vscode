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
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
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
	}

	async function createHarness() {
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
});
