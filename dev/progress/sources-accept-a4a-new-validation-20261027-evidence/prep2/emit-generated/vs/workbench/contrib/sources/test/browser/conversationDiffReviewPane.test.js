import assert from "assert";
import { DeferredPromise } from "../../../../../base/common/async.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { IDiffProviderFactoryService } from "../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js";
import { TestDiffProviderFactoryService } from "../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { emptyProgressRunner, IEditorProgressService } from "../../../../../platform/progress/common/progress.js";
import { IUserInteractionService, MockUserInteractionService } from "../../../../../platform/userInteraction/browser/userInteractionService.js";
import { IUniverseAgentConnection } from "../../../../../platform/universeAgent/common/universeAgentConnection.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { IAgentSessionContext } from "../../../../services/agentSession/common/agentSessionContext.js";
import { workbenchInstantiationService, TestEditorGroupView } from "../../../../test/browser/workbenchTestServices.js";
import { IConversationRosterService } from "../../../conversation/browser/conversationStubService.js";
import { ISCMService } from "../../../scm/common/scm.js";
import { ConversationDiffReviewInput } from "../../browser/conversationDiffReviewInput.js";
import { ConversationDiffReviewPane } from "../../browser/conversationDiffReviewPane.js";
import { SOURCES_DIFF_PANEL_CONTAINER_ID } from "../../browser/sourcesDiffPanelIds.js";
import { ISourcesChangesModel } from "../../common/sourcesChangesModel.js";
import { SourcesChangesModel } from "../../common/sourcesChangesReadModel.js";
suite("Conversation diff review pane", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  const acceptedWrite = {
    supported: true,
    reason: "",
    success: true,
    errorMessage: "",
    exitCode: 0,
    stdout: ""
  };
  const acceptCursorUnifiedDiff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,3 +1,4 @@",
    " line1",
    "-old",
    "+new",
    "+extra"
  ].join("\n");
  function createLeftoverScmService(resource, groupId = "workingTree") {
    const group = {
      id: groupId,
      label: groupId === "index" ? "Staged Changes" : "Changes",
      resources: []
    };
    const scmResource = {
      sourceUri: resource,
      resourceGroup: group,
      decorations: {},
      open: async () => {
      }
    };
    group.resources.push(scmResource);
    const repository = {
      provider: {
        groups: [group],
        rootUri: resource,
        onDidChangeResources: Event.None,
        onDidChangeResourceGroups: Event.None
      }
    };
    return {
      _serviceBrand: void 0,
      get repositories() {
        return [repository];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
  }
  function stubSessionAndChangesModel(instantiationService, connection) {
    instantiationService.stub(IAgentSessionContext, {
      _serviceBrand: void 0,
      getActiveSessionId: () => "session-1",
      isEngineSessionReady: () => true,
      isPairingHold: () => false,
      onDidChangeActiveSession: Event.None,
      onDidChangeSession: Event.None,
      acquireSessionView: () => {
        throw new Error("not used");
      }
    });
    instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
    instantiationService.stub(IConversationRosterService, {
      getActiveSessionId: () => "session-1",
      onDidChangeActiveSession: Event.None,
      onDidChangeSession: Event.None,
      isEngineSessionReady: () => true
    });
    instantiationService.stub(IUniverseAgentConnection, connection);
  }
  function createInstantiationService(resource, connection, resolveModels = false) {
    const instantiationService = workbenchInstantiationService(void 0, store);
    instantiationService.stub(IViewDescriptorService, {
      getViewLocationById: () => ViewContainerLocation.Panel,
      onDidChangeLocation: Event.None,
      getViewDescriptorById: () => null,
      getViewContainerByViewId: () => ({
        id: SOURCES_DIFF_PANEL_CONTAINER_ID,
        title: { value: "Diff", original: "Diff" },
        ctorDescriptor: {}
      }),
      getViewContainerModel: () => ({
        onDidChangeContainerInfo: Event.None
      }),
      getDefaultContainerById: () => null
    });
    instantiationService.stub(ISCMService, createLeftoverScmService(resource));
    instantiationService.stub(IUniverseAgentConnection, connection);
    stubSessionAndChangesModel(instantiationService, connection);
    instantiationService.stub(ICommandService, {
      onWillExecuteCommand: Event.None,
      onDidExecuteCommand: Event.None,
      executeCommand: async () => void 0
    });
    if (resolveModels) {
      instantiationService.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
      instantiationService.stub(IUserInteractionService, new MockUserInteractionService());
      instantiationService.stub(IEditorProgressService, {
        _serviceBrand: void 0,
        show: () => emptyProgressRunner,
        showWhile: async (promise) => {
          await promise;
        }
      });
    } else {
      instantiationService.stub(ITextModelService, {
        createModelReference: async () => {
          throw new Error("boom");
        }
      });
    }
    return instantiationService;
  }
  function paintReviewWriteChrome(pane) {
    const host = pane;
    host.comparisonLoadFailed = false;
    host.updateReviewActions();
  }
  test("Accept post-read authorization input.dispose with live Pane and identical input sends no ApplyHunks", async () => {
    const resource = URI.parse("inmemory://accept-input-dispose/modified");
    const original = URI.parse("inmemory://accept-input-dispose/original");
    const started = new DeferredPromise();
    const release = new DeferredPromise();
    store.add({ dispose: () => {
      void release.complete();
    } });
    const reads = [];
    const applies = [];
    const commands = [];
    const validDiff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,2 @@",
      " line1",
      "-old",
      "+new"
    ].join("\n");
    const connection = {
      isEngineConnected: () => true,
      getConnectionPhase: () => ({ kind: "connected" }),
      getConnectionSnapshot: () => ({ pairingPending: false }),
      onDidChangeConnection: Event.None,
      readGitFileDiff: async (request) => {
        reads.push(request);
        void started.complete();
        await release.p;
        return { supported: true, reason: "", path: request.path, unifiedDiff: validDiff };
      },
      writeGitApplyHunks: async (request) => {
        applies.push(request);
        return acceptedWrite;
      }
    };
    const instantiation = createInstantiationService(resource, connection, true);
    instantiation.stub(ICommandService, {
      _serviceBrand: void 0,
      onWillExecuteCommand: Event.None,
      onDidExecuteCommand: Event.None,
      executeCommand: async (id) => {
        commands.push(id);
        return void 0;
      }
    });
    const pane = store.add(instantiation.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const models = instantiation.get(IModelService);
    store.add(models.createModel("line1\nold", null, original));
    store.add(models.createModel("line1\nnew", null, resource));
    const resolver = instantiation.get(ITextModelService);
    store.add(await resolver.createModelReference(original));
    store.add(await resolver.createModelReference(resource));
    const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree", {
      origin: "engine",
      sessionId: "session-1",
      gitPath: "src/a.ts",
      kind: "Modified",
      indexState: "Unstaged"
    }));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    assert.strictEqual(pane.didComparisonLoadFail(), false);
    pane.acceptCursor = { side: "new", line: 2 };
    const operation = pane.runAccept();
    try {
      await Promise.race([started.p, operation.then(() => {
        throw new Error("Accept returned before FileDiff started");
      })]);
      input.dispose();
      assert.strictEqual(pane.input, input);
      assert.strictEqual(input.isDisposed(), true);
      await release.complete();
      await operation;
      assert.deepStrictEqual({ reads, applies, commands }, {
        reads: [{ sessionId: "session-1", path: "src/a.ts", indexState: "Unstaged" }],
        applies: [],
        commands: []
      });
    } finally {
      await release.complete();
      await operation;
    }
  });
  test("in-flight Accept does not ApplyHunks after clearInput bumps write generation", async function() {
    const resource = toResource.call(this, "/project/src/inflight-accept-clear.ts");
    const original = toResource.call(this, "/project/src/inflight-accept-clear.ts.git");
    const applyCalls = [];
    let releaseRead;
    const readGate = new Promise((resolve) => {
      releaseRead = resolve;
    });
    let readInFlight = false;
    const connection = {
      isEngineConnected: () => true,
      getConnectionPhase: () => ({ kind: "connected" }),
      getConnectionSnapshot: () => ({ pairingPending: false }),
      onDidChangeConnection: Event.None,
      readGitFileDiff: async () => {
        readInFlight = true;
        await readGate;
        return { supported: true, reason: "", path: "src/a.ts", unifiedDiff: acceptCursorUnifiedDiff };
      },
      writeGitApplyHunks: async (request) => {
        applyCalls.push(request);
        return acceptedWrite;
      },
      writeGitStagePaths: async (request) => {
        return acceptedWrite;
      }
    };
    const instantiationService = createInstantiationService(resource, connection);
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree", {
      origin: "engine",
      sessionId: "session-1",
      gitPath: "src/a.ts",
      indexState: "Unstaged",
      kind: "Modified"
    }));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    paintReviewWriteChrome(pane);
    pane.acceptCursor = { side: "new", line: 3 };
    const acceptPromise = pane.runAccept();
    while (!readInFlight) {
      await Promise.resolve();
    }
    pane.clearInput();
    releaseRead();
    await acceptPromise;
    assert.deepStrictEqual(applyCalls, []);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvdGVzdC9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUsIHRvUmVzb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSURpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9kaWZmL3Rlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBlbXB0eVByb2dyZXNzUnVubmVyLCBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElVc2VySW50ZXJhY3Rpb25TZXJ2aWNlLCBNb2NrVXNlckludGVyYWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJJbnRlcmFjdGlvbi9icm93c2VyL3VzZXJJbnRlcmFjdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHR5cGUgeyBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdCwgVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QsIFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0LCBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3VuaXZlcnNlQWdlbnRUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBJVmlld1BhbmVDb250YWluZXIsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJQWdlbnRTZXNzaW9uQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2FnZW50U2Vzc2lvbi9jb21tb24vYWdlbnRTZXNzaW9uQ29udGV4dC5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSwgVGVzdEVkaXRvckdyb3VwVmlldyB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25TdHViU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU0NNUmVzb3VyY2UsIElTQ01TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2NtL2NvbW1vbi9zY20uanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfRElGRl9QQU5FTF9DT05UQUlORVJfSUQgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvdXJjZXNEaWZmUGFuZWxJZHMuanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VzTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0NoYW5nZXNNb2RlbC5qcyc7XG5pbXBvcnQgeyBTb3VyY2VzQ2hhbmdlc01vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzUmVhZE1vZGVsLmpzJztcblxuc3VpdGUoJ0NvbnZlcnNhdGlvbiBkaWZmIHJldmlldyBwYW5lJywgKCkgPT4ge1xuXG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgYWNjZXB0ZWRXcml0ZTogVW5pdmVyc2VBZ2VudFdyaXRlR2l0V3JpdGVSZXN1bHQgPSB7XG5cdFx0c3VwcG9ydGVkOiB0cnVlLFxuXHRcdHJlYXNvbjogJycsXG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRlcnJvck1lc3NhZ2U6ICcnLFxuXHRcdGV4aXRDb2RlOiAwLFxuXHRcdHN0ZG91dDogJycsXG5cdH07XG5cblx0Y29uc3QgYWNjZXB0Q3Vyc29yVW5pZmllZERpZmYgPSBbXG5cdFx0J2RpZmYgLS1naXQgYS9zcmMvYS50cyBiL3NyYy9hLnRzJyxcblx0XHQnLS0tIGEvc3JjL2EudHMnLFxuXHRcdCcrKysgYi9zcmMvYS50cycsXG5cdFx0J0BAIC0xLDMgKzEsNCBAQCcsXG5cdFx0JyBsaW5lMScsXG5cdFx0Jy1vbGQnLFxuXHRcdCcrbmV3Jyxcblx0XHQnK2V4dHJhJyxcblx0XS5qb2luKCdcXG4nKTtcblxuXHRmdW5jdGlvbiBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2U6IFVSSSwgZ3JvdXBJZCA9ICd3b3JraW5nVHJlZScpOiBJU0NNU2VydmljZSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB7XG5cdFx0XHRpZDogZ3JvdXBJZCxcblx0XHRcdGxhYmVsOiBncm91cElkID09PSAnaW5kZXgnID8gJ1N0YWdlZCBDaGFuZ2VzJyA6ICdDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCBzY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiBncm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKHNjbVJlc291cmNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0ge1xuXHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0Z3JvdXBzOiBbZ3JvdXBdLFxuXHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbcmVwb3NpdG9yeV07IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBzdHViU2Vzc2lvbkFuZENoYW5nZXNNb2RlbChcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZTogUmV0dXJuVHlwZTx0eXBlb2Ygd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2U+LFxuXHRcdGNvbm5lY3Rpb246IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbixcblx0KTogdm9pZCB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQWdlbnRTZXNzaW9uQ29udGV4dCwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiAnc2Vzc2lvbi0xJyxcblx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0aXNQYWlyaW5nSG9sZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgdXNlZCcpOyB9LFxuXHRcdH0gc2F0aXNmaWVzIElBZ2VudFNlc3Npb25Db250ZXh0KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzQ2hhbmdlc01vZGVsLCBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0NoYW5nZXNNb2RlbCkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlLCB7XG5cdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiwgY29ubmVjdGlvbik7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVJbnN0YW50aWF0aW9uU2VydmljZShyZXNvdXJjZTogVVJJLCBjb25uZWN0aW9uOiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIHJlc29sdmVNb2RlbHMgPSBmYWxzZSkge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCB7XG5cdFx0XHRnZXRWaWV3TG9jYXRpb25CeUlkOiAoKSA9PiBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsXG5cdFx0XHRvbkRpZENoYW5nZUxvY2F0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0Z2V0Vmlld0Rlc2NyaXB0b3JCeUlkOiAoKSA9PiBudWxsLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkOiAoKSA9PiAoe1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX0NPTlRBSU5FUl9JRCxcblx0XHRcdFx0dGl0bGU6IHsgdmFsdWU6ICdEaWZmJywgb3JpZ2luYWw6ICdEaWZmJyB9LFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjoge30gYXMgU3luY0Rlc2NyaXB0b3I8SVZpZXdQYW5lQ29udGFpbmVyPixcblx0XHRcdH0pLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lck1vZGVsOiAoKSA9PiAoe1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbnRhaW5lckluZm86IEV2ZW50Lk5vbmUsXG5cdFx0XHR9KSxcblx0XHRcdGdldERlZmF1bHRDb250YWluZXJCeUlkOiAoKSA9PiBudWxsLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiwgY29ubmVjdGlvbik7XG5cdFx0c3R1YlNlc3Npb25BbmRDaGFuZ2VzTW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGNvbm5lY3Rpb24pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbW1hbmRTZXJ2aWNlLCB7XG5cdFx0XHRvbldpbGxFeGVjdXRlQ29tbWFuZDogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkRXhlY3V0ZUNvbW1hbmQ6IEV2ZW50Lk5vbmUsXG5cdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKCkgPT4gdW5kZWZpbmVkLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGlmIChyZXNvbHZlTW9kZWxzKSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElEaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSwgbmV3IFRlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSgpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVzZXJJbnRlcmFjdGlvblNlcnZpY2UsIG5ldyBNb2NrVXNlckludGVyYWN0aW9uU2VydmljZSgpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclByb2dyZXNzU2VydmljZSwge1xuXHRcdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsIHNob3c6ICgpID0+IGVtcHR5UHJvZ3Jlc3NSdW5uZXIsXG5cdFx0XHRcdHNob3dXaGlsZTogYXN5bmMgcHJvbWlzZSA9PiB7IGF3YWl0IHByb21pc2U7IH0sXG5cdFx0XHR9IHNhdGlzZmllcyBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGV4dE1vZGVsU2VydmljZSwge1xuXHRcdFx0XHRjcmVhdGVNb2RlbFJlZmVyZW5jZTogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignYm9vbScpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElUZXh0TW9kZWxTZXJ2aWNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSk6IHZvaWQge1xuXHRcdGNvbnN0IGhvc3QgPSBwYW5lIGFzIHVua25vd24gYXMgeyBjb21wYXJpc29uTG9hZEZhaWxlZDogYm9vbGVhbjsgdXBkYXRlUmV2aWV3QWN0aW9uczogKCkgPT4gdm9pZCB9O1xuXHRcdGhvc3QuY29tcGFyaXNvbkxvYWRGYWlsZWQgPSBmYWxzZTtcblx0XHRob3N0LnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0fVxuXG5cdHRlc3QoJ0FjY2VwdCBwb3N0LXJlYWQgYXV0aG9yaXphdGlvbiBpbnB1dC5kaXNwb3NlIHdpdGggbGl2ZSBQYW5lIGFuZCBpZGVudGljYWwgaW5wdXQgc2VuZHMgbm8gQXBwbHlIdW5rcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5wYXJzZSgnaW5tZW1vcnk6Ly9hY2NlcHQtaW5wdXQtZGlzcG9zZS9tb2RpZmllZCcpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gVVJJLnBhcnNlKCdpbm1lbW9yeTovL2FjY2VwdC1pbnB1dC1kaXNwb3NlL29yaWdpbmFsJyk7XG5cdFx0Y29uc3Qgc3RhcnRlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRjb25zdCByZWxlYXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHsgdm9pZCByZWxlYXNlLmNvbXBsZXRlKCk7IH0gfSk7XG5cdFx0Y29uc3QgcmVhZHM6IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBhcHBsaWVzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29tbWFuZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgdmFsaWREaWZmID0gW1xuXHRcdFx0J2RpZmYgLS1naXQgYS9zcmMvYS50cyBiL3NyYy9hLnRzJywgJy0tLSBhL3NyYy9hLnRzJywgJysrKyBiL3NyYy9hLnRzJyxcblx0XHRcdCdAQCAtMSwyICsxLDIgQEAnLCAnIGxpbmUxJywgJy1vbGQnLCAnK25ldycsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnIGFzIGNvbnN0IH0pLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRyZWFkcy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHR2b2lkIHN0YXJ0ZWQuY29tcGxldGUoKTtcblx0XHRcdFx0YXdhaXQgcmVsZWFzZS5wO1xuXHRcdFx0XHRyZXR1cm4geyBzdXBwb3J0ZWQ6IHRydWUsIHJlYXNvbjogJycsIHBhdGg6IHJlcXVlc3QucGF0aCwgdW5pZmllZERpZmY6IHZhbGlkRGlmZiB9O1xuXHRcdFx0fSxcblx0XHRcdHdyaXRlR2l0QXBwbHlIdW5rczogYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0KSA9PiB7XG5cdFx0XHRcdGFwcGxpZXMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0cmV0dXJuIGFjY2VwdGVkV3JpdGU7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvbiA9IGNyZWF0ZUluc3RhbnRpYXRpb25TZXJ2aWNlKHJlc291cmNlLCBjb25uZWN0aW9uLCB0cnVlKTtcblx0XHRpbnN0YW50aWF0aW9uLnN0dWIoSUNvbW1hbmRTZXJ2aWNlLCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsIG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLCBvbkRpZEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIDxUPihpZDogc3RyaW5nKTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPiA9PiB7IGNvbW1hbmRzLnB1c2goaWQpOyByZXR1cm4gdW5kZWZpbmVkOyB9LFxuXHRcdH0gc2F0aXNmaWVzIElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRjb25zdCBtb2RlbHMgPSBpbnN0YW50aWF0aW9uLmdldChJTW9kZWxTZXJ2aWNlKTtcblx0XHRzdG9yZS5hZGQobW9kZWxzLmNyZWF0ZU1vZGVsKCdsaW5lMVxcbm9sZCcsIG51bGwsIG9yaWdpbmFsKSk7XG5cdFx0c3RvcmUuYWRkKG1vZGVscy5jcmVhdGVNb2RlbCgnbGluZTFcXG5uZXcnLCBudWxsLCByZXNvdXJjZSkpO1xuXHRcdGNvbnN0IHJlc29sdmVyID0gaW5zdGFudGlhdGlvbi5nZXQoSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdHN0b3JlLmFkZChhd2FpdCByZXNvbHZlci5jcmVhdGVNb2RlbFJlZmVyZW5jZShvcmlnaW5hbCkpO1xuXHRcdHN0b3JlLmFkZChhd2FpdCByZXNvbHZlci5jcmVhdGVNb2RlbFJlZmVyZW5jZShyZXNvdXJjZSkpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnLCB7XG5cdFx0XHRvcmlnaW46ICdlbmdpbmUnLCBzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLCBnaXRQYXRoOiAnc3JjL2EudHMnLCBraW5kOiAnTW9kaWZpZWQnLCBpbmRleFN0YXRlOiAnVW5zdGFnZWQnLFxuXHRcdH0pKTtcblx0XHRhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmRpZENvbXBhcmlzb25Mb2FkRmFpbCgpLCBmYWxzZSk7XG5cdFx0KHBhbmUgYXMgdW5rbm93biBhcyB7IGFjY2VwdEN1cnNvcjogeyBzaWRlOiAnbmV3JzsgbGluZTogbnVtYmVyIH0gfSkuYWNjZXB0Q3Vyc29yID0geyBzaWRlOiAnbmV3JywgbGluZTogMiB9O1xuXHRcdGNvbnN0IG9wZXJhdGlvbiA9IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQoKTogUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yYWNlKFtzdGFydGVkLnAsIG9wZXJhdGlvbi50aGVuKCgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdBY2NlcHQgcmV0dXJuZWQgYmVmb3JlIEZpbGVEaWZmIHN0YXJ0ZWQnKTsgfSldKTtcblx0XHRcdGlucHV0LmRpc3Bvc2UoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LCBpbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQuaXNEaXNwb3NlZCgpLCB0cnVlKTtcblx0XHRcdGF3YWl0IHJlbGVhc2UuY29tcGxldGUoKTtcblx0XHRcdGF3YWl0IG9wZXJhdGlvbjtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyByZWFkcywgYXBwbGllcywgY29tbWFuZHMgfSwge1xuXHRcdFx0XHRyZWFkczogW3sgc2Vzc2lvbklkOiAnc2Vzc2lvbi0xJywgcGF0aDogJ3NyYy9hLnRzJywgaW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyB9XSwgYXBwbGllczogW10sIGNvbW1hbmRzOiBbXSxcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7IGF3YWl0IHJlbGVhc2UuY29tcGxldGUoKTsgYXdhaXQgb3BlcmF0aW9uOyB9XG5cdH0pO1xuXG5cdHRlc3QoJ2luLWZsaWdodCBBY2NlcHQgZG9lcyBub3QgQXBwbHlIdW5rcyBhZnRlciBjbGVhcklucHV0IGJ1bXBzIHdyaXRlIGdlbmVyYXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9pbmZsaWdodC1hY2NlcHQtY2xlYXIudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2luZmxpZ2h0LWFjY2VwdC1jbGVhci50cy5naXQnKTtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0bGV0IHJlbGVhc2VSZWFkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVhZEdhdGUgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdHJlbGVhc2VSZWFkID0gcmVzb2x2ZTtcblx0XHR9KTtcblx0XHRsZXQgcmVhZEluRmxpZ2h0ID0gZmFsc2U7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJyBhcyBjb25zdCB9KSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlYWRJbkZsaWdodCA9IHRydWU7XG5cdFx0XHRcdGF3YWl0IHJlYWRHYXRlO1xuXHRcdFx0XHRyZXR1cm4geyBzdXBwb3J0ZWQ6IHRydWUsIHJlYXNvbjogJycsIHBhdGg6ICdzcmMvYS50cycsIHVuaWZpZWREaWZmOiBhY2NlcHRDdXJzb3JVbmlmaWVkRGlmZiB9O1xuXHRcdFx0fSxcblx0XHRcdHdyaXRlR2l0QXBwbHlIdW5rczogYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0KSA9PiB7XG5cdFx0XHRcdGFwcGx5Q2FsbHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0cmV0dXJuIGFjY2VwdGVkV3JpdGU7XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVHaXRTdGFnZVBhdGhzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0cmV0dXJuIGFjY2VwdGVkV3JpdGU7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZUluc3RhbnRpYXRpb25TZXJ2aWNlKHJlc291cmNlLCBjb25uZWN0aW9uKTtcblx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJywge1xuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2EudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyxcblx0XHRcdGtpbmQ6ICdNb2RpZmllZCcsXG5cdFx0fSkpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHQocGFuZSBhcyB1bmtub3duIGFzIHsgYWNjZXB0Q3Vyc29yOiB7IHNpZGU6ICduZXcnOyBsaW5lOiBudW1iZXIgfSB9KS5hY2NlcHRDdXJzb3IgPSB7IHNpZGU6ICduZXcnLCBsaW5lOiAzIH07XG5cblx0XHRjb25zdCBhY2NlcHRQcm9taXNlID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHR3aGlsZSAoIXJlYWRJbkZsaWdodCkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXHRcdHBhbmUuY2xlYXJJbnB1dCgpO1xuXHRcdHJlbGVhc2VSZWFkISgpO1xuXHRcdGF3YWl0IGFjY2VwdFByb21pc2U7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMseUNBQXlDLGtCQUFrQjtBQUNwRSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLHFCQUFxQiw4QkFBOEI7QUFDNUQsU0FBUyx5QkFBeUIsa0NB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
