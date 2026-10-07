/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { IEditorGroup, IConversationEditorPart, IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { IConversationNavigationService } from "../../browser/conversationNavigationService.js";
import { ConversationNavigationContribution } from "../../browser/conversationNavigation.contribution.js";
import { ConversationSessionChatContribution } from "../../browser/conversationSessionChat.contribution.js";
import { ConversationSessionChatService } from "../../browser/conversationSessionChatService.js";
import { IConversationSessionChatService } from "../../common/conversationSessionChat.js";
import { IConversationSessionWindowService } from "../../browser/conversationSessionWindowService.js";
import { ConversationEngineRosterService } from "../../browser/conversationEngineRosterService.js";
import { IUniverseAgentConnection } from "../../../../../platform/universeAgent/common/universeAgentConnection.js";
import { IUniverseAgentSessionView } from "../../../../../platform/universeAgent/common/universeAgentSessionView.js";
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from "./conversationTimelineLinkTestStubs.js";
import { MockUniverseAgentConnection } from "./conversationEngineRosterService.test.js";
import { ConversationStubService, IConversationRosterService } from "../../browser/conversationStubService.js";
import { IConversationPartService } from "../../../../browser/parts/conversation/conversationPart.js";
import { createConversationConnectionTestStub } from "../common/conversationConnectionTestStub.js";

suite("Conversation lifecycle and refresh", () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite("ConversationNavigationContribution", () => {
		test("remountLeafNav disposes and cleans up leafNavStores when session key leaves visible leaves", () => {
			const onDidChangeVisibleWindows = store.add(new Emitter<void>());
			let activeKeys = ["session-a", "session-b"];

			const barA = document.createElement("div");
			const winA = document.createElement("div");
			const barB = document.createElement("div");
			const winB = document.createElement("div");

			const sessionWindowService: IConversationSessionWindowService = {
				...createNoopConversationSessionWindowService(),
				getAllLeafSessionKeys: () => activeKeys,
				getLeafSlots: (key: string) => {
					if (key === "session-a") {
						return { sessionKey: "session-a", container: barA, sessionBar: barA, sessionWindow: winA, editorPartHost: winA };
					}
					if (key === "session-b") {
						return { sessionKey: "session-b", container: barB, sessionBar: barB, sessionWindow: winB, editorPartHost: winB };
					}
					return undefined;
				},
				onDidChangeVisibleWindows: onDidChangeVisibleWindows.event,
			};

			const instantiationService = workbenchInstantiationService({}, store);
			instantiationService.stub(IConversationNavigationService, {
				_serviceBrand: undefined,
				onDidChangeStack: Event.None,
				registerPart: () => ({ dispose: () => { } }),
				canGoBack: () => true,
				canGoForward: () => true,
				goBack: async () => { },
				goForward: async () => { },
			});
			instantiationService.stub(IConversationSessionWindowService, sessionWindowService);
			instantiationService.stub(IConversationSessionChatService, createEmptyConversationSessionChatService());

			store.add(instantiationService.createInstance(ConversationNavigationContribution));

			assert.ok(winA.querySelector(".conversation-editor-nav"));
			assert.ok(barA.querySelector(".conversation-agent-up"));
			assert.ok(winB.querySelector(".conversation-editor-nav"));
			assert.ok(barB.querySelector(".conversation-agent-up"));

			// session-a unmounts
			activeKeys = ["session-b"];
			onDidChangeVisibleWindows.fire();

			assert.strictEqual(winA.querySelector(".conversation-editor-nav"), null);
			assert.strictEqual(barA.querySelector(".conversation-agent-up"), null);
			assert.ok(winB.querySelector(".conversation-editor-nav"));
			assert.ok(barB.querySelector(".conversation-agent-up"));
		});

		test("registerExistingParts disposes part listeners when part fires onWillDispose", () => {
			const onDidAddGroup = store.add(new Emitter<IEditorGroup>());
			const onDidRemoveGroup = store.add(new Emitter<IEditorGroup>());
			const onPartWillDispose = store.add(new Emitter<void>());

			let navPartDisposed = false;
			let chatPartDisposed = false;

			const fakePart: IConversationEditorPart = {
				excludeFromGlobalEditorAggregation: true,
				sessionKey: "session-part-1",
				onWillDispose: onPartWillDispose.event,
			} as unknown as IConversationEditorPart;

			const editorGroupsService: IEditorGroupsService = {
				conversationParts: [fakePart],
				onDidAddGroup: onDidAddGroup.event,
				onDidRemoveGroup: onDidRemoveGroup.event,
			} as unknown as IEditorGroupsService;

			const instantiationService = workbenchInstantiationService({}, store);
			instantiationService.stub(IEditorGroupsService, editorGroupsService);
			instantiationService.stub(IConversationNavigationService, {
				_serviceBrand: undefined,
				onDidChangeStack: Event.None,
				registerPart: () => ({
					dispose: () => {
						navPartDisposed = true;
					}
				}),
				canGoBack: () => true,
				canGoForward: () => true,
				goBack: async () => { },
				goForward: async () => { },
			});
			instantiationService.stub(IConversationSessionChatService, {
				...createEmptyConversationSessionChatService(),
				registerPartListeners: () => ({
					dispose: () => {
						chatPartDisposed = true;
					}
				}),
			});
			instantiationService.stub(IConversationSessionWindowService, createNoopConversationSessionWindowService());

			store.add(instantiationService.createInstance(ConversationNavigationContribution));

			assert.strictEqual(navPartDisposed, false);
			assert.strictEqual(chatPartDisposed, false);

			onPartWillDispose.fire();
			assert.strictEqual(navPartDisposed, true);
			assert.strictEqual(chatPartDisposed, true);
		});

		test("registerExistingParts disposes part listeners when part is removed from conversationParts", () => {
			const onDidAddGroup = store.add(new Emitter<IEditorGroup>());
			const onDidRemoveGroup = store.add(new Emitter<IEditorGroup>());
			const onPartWillDispose = store.add(new Emitter<void>());

			let navPartDisposed = false;
			let chatPartDisposed = false;

			const fakePart: IConversationEditorPart = {
				excludeFromGlobalEditorAggregation: true,
				sessionKey: "session-part-2",
				onWillDispose: onPartWillDispose.event,
			} as unknown as IConversationEditorPart;

			let partsList = [fakePart];

			const editorGroupsService: IEditorGroupsService = {
				get conversationParts() { return partsList; },
				onDidAddGroup: onDidAddGroup.event,
				onDidRemoveGroup: onDidRemoveGroup.event,
			} as unknown as IEditorGroupsService;

			const instantiationService = workbenchInstantiationService({}, store);
			instantiationService.stub(IEditorGroupsService, editorGroupsService);
			instantiationService.stub(IConversationNavigationService, {
				_serviceBrand: undefined,
				onDidChangeStack: Event.None,
				registerPart: () => ({
					dispose: () => {
						navPartDisposed = true;
					}
				}),
				canGoBack: () => true,
				canGoForward: () => true,
				goBack: async () => { },
				goForward: async () => { },
			});
			instantiationService.stub(IConversationSessionChatService, {
				...createEmptyConversationSessionChatService(),
				registerPartListeners: () => ({
					dispose: () => {
						chatPartDisposed = true;
					}
				}),
			});
			instantiationService.stub(IConversationSessionWindowService, createNoopConversationSessionWindowService());

			store.add(instantiationService.createInstance(ConversationNavigationContribution));

			assert.strictEqual(navPartDisposed, false);
			assert.strictEqual(chatPartDisposed, false);

			partsList = [];
			onDidRemoveGroup.fire({} as IEditorGroup);
			assert.strictEqual(navPartDisposed, true);
			assert.strictEqual(chatPartDisposed, true);
		});
	});

	suite("ConversationSessionChatService and Contribution overlay lifecycle", () => {
		test("unmountSubAgentOverlay disposes overlay and removes DOM element", () => {
			const host = document.createElement("div");
			document.body.appendChild(host);
			store.add({ dispose: () => host.remove() });

			const instantiationService = workbenchInstantiationService({}, store);
			instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
			instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
			const sessionChatService = store.add(instantiationService.createInstance(ConversationSessionChatService));

			sessionChatService.mountSubAgentOverlay("session-1", host);
			assert.ok(host.querySelector(".conversation-subagent-overlay"));

			sessionChatService.unmountSubAgentOverlay("session-1");
			assert.strictEqual(host.querySelector(".conversation-subagent-overlay"), null);
		});

		test("ConversationSessionChatContribution unmounts overlay when leaf leaves visible windows and remounts on new host", () => {
			const hostA = document.createElement("div");
			const hostB = document.createElement("div");
			document.body.appendChild(hostA);
			document.body.appendChild(hostB);
			store.add({ dispose: () => { hostA.remove(); hostB.remove(); } });

			const onDidChangeVisibleWindows = store.add(new Emitter<void>());

			let activeKeys = ["session-1"];
			let currentHost = hostA;

			const sessionWindowService: IConversationSessionWindowService = {
				...createNoopConversationSessionWindowService(),
				getAllLeafSessionKeys: () => activeKeys,
				getLeafSlots: (key: string) => {
					if (key === "session-1") {
						return { sessionKey: "session-1", container: currentHost, sessionBar: currentHost, sessionWindow: currentHost, editorPartHost: currentHost };
					}
					return undefined;
				},
				onDidChangeVisibleWindows: onDidChangeVisibleWindows.event,
			};

			const instantiationService = workbenchInstantiationService({}, store);
			instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
			instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
			const sessionChatService = store.add(instantiationService.createInstance(ConversationSessionChatService));
			instantiationService.stub(IConversationPartService, {
				_serviceBrand: undefined,
				getSlots: () => ({} as any),
				onDidCreateSlots: Event.None,
			} as unknown as IConversationPartService);
			instantiationService.stub(IConversationSessionChatService, sessionChatService);
			instantiationService.stub(IConversationSessionWindowService, sessionWindowService);

			store.add(instantiationService.createInstance(ConversationSessionChatContribution));

			// Host A should have the overlay
			assert.ok(hostA.querySelector(".conversation-subagent-overlay"));

			// Leaf unmounts
			activeKeys = [];
			onDidChangeVisibleWindows.fire();

			// Host A no longer has the overlay
			assert.strictEqual(hostA.querySelector(".conversation-subagent-overlay"), null);

			// Leaf remounts with new host B
			activeKeys = ["session-1"];
			currentHost = hostB;
			onDidChangeVisibleWindows.fire();

			// Host B now has the overlay, Host A stays clean
			assert.ok(hostB.querySelector(".conversation-subagent-overlay"));
			assert.strictEqual(hostA.querySelector(".conversation-subagent-overlay"), null);
		});
	});

	suite("ConversationEngineRosterService request generation and connection validation", () => {
		test("stale in-flight listSessions is discarded when connection generation changes", async () => {
			const connection = store.add(new MockUniverseAgentConnection());
			let resolveFirstList: (value: { sessions: { sessionId: string; title: string }[] }) => void;
			const firstListPromise = new Promise<{ sessions: { sessionId: string; title: string }[] }>(resolve => {
				resolveFirstList = resolve;
			});

			connection.listSessions = async () => {
				return firstListPromise;
			};

			const sessionView: IUniverseAgentSessionView = {
				_serviceBrand: undefined,
				onDynamicDidApplyFrame: () => Event.None,
				acquireLease: async (sessionId: string) => `lease:${sessionId}`,
				releaseLease: async () => { },
				post: async () => ({ accepted: true as const, correlation: { id: "mock" } }),
				requestResync: async () => { },
				acknowledge: async () => { },
				requestDetail: async () => ({ ok: false as const, reason: "unavailable" as const }),
				whenEngineSessionReady: async (sessionId: string) => sessionId,
			};
			const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
			const service = store.add(new ConversationEngineRosterService(
				connection as unknown as IUniverseAgentConnection,
				sessionView,
				workspaceToolsGate,
			));

			connection.setConnected(true);
			service.setEngineConnected(true);

			// Set the second list response for the new connection
			connection.listSessions = async () => ({
				sessions: [{ sessionId: "sess-new", title: "New Engine Session" }],
			});

			// Connection is changed/switched while first list is in flight
			connection.setPublishedLink("new-engine-bucket", 1, true);

			// Now resolve the old in-flight list with old sessions
			resolveFirstList!({
				sessions: [{ sessionId: "sess-old", title: "Old Engine Session" }],
			});

			await service.whenEngineCatalogRefreshComplete();

			// The old sessions must NOT appear in the new engine bucket
			const sessions = service.getSessions();
			assert.ok(!sessions.some(s => s.id === "sess-old"), "Stale sessions from old connection must be discarded");
			assert.strictEqual(sessions.map(s => s.id).join(","), "sess-new");
		});

		test("in-flight listSessions failure from stale connection does not mark new connection as bind-failed", async () => {
			const connection = store.add(new MockUniverseAgentConnection());
			let rejectFirstList: (error: Error) => void;
			const firstListPromise = new Promise<{ sessions: { sessionId: string; title: string }[] }>((_, reject) => {
				rejectFirstList = reject;
			});

			connection.listSessions = async () => {
				return firstListPromise;
			};

			const sessionView: IUniverseAgentSessionView = {
				_serviceBrand: undefined,
				onDynamicDidApplyFrame: () => Event.None,
				acquireLease: async (sessionId: string) => `lease:${sessionId}`,
				releaseLease: async () => { },
				post: async () => ({ accepted: true as const, correlation: { id: "mock" } }),
				requestResync: async () => { },
				acknowledge: async () => { },
				requestDetail: async () => ({ ok: false as const, reason: "unavailable" as const }),
				whenEngineSessionReady: async (sessionId: string) => sessionId,
			};
			const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
			const service = store.add(new ConversationEngineRosterService(
				connection as unknown as IUniverseAgentConnection,
				sessionView,
				workspaceToolsGate,
			));

			connection.setConnected(true);
			service.setEngineConnected(true);

			// Set the second list response for the new connection
			connection.listSessions = async () => ({
				sessions: [{ sessionId: "sess-new", title: "New Engine Session" }],
			});

			// Connection changed to new engine
			connection.setPublishedLink("new-engine-bucket", 1, true);

			// Old connection list fails
			rejectFirstList!(new Error("Old connection dropped"));

			await service.whenEngineCatalogRefreshComplete();

			// New connection must not be marked bind-failed
			assert.strictEqual(service.isEngineSessionReady(), true);
			const sessions = service.getSessions();
			assert.strictEqual(sessions.length, 1);
			assert.strictEqual(sessions[0]?.id, "sess-new");
		});
	});
});
