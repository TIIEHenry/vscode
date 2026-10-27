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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvdGVzdC9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUsIHRvUmVzb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSURpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9kaWZmL3Rlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBlbXB0eVByb2dyZXNzUnVubmVyLCBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElVc2VySW50ZXJhY3Rpb25TZXJ2aWNlLCBNb2NrVXNlckludGVyYWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJJbnRlcmFjdGlvbi9icm93c2VyL3VzZXJJbnRlcmFjdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHR5cGUgeyBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdCwgVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QsIFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0LCBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3VuaXZlcnNlQWdlbnRUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBJVmlld1BhbmVDb250YWluZXIsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJQWdlbnRTZXNzaW9uQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2FnZW50U2Vzc2lvbi9jb21tb24vYWdlbnRTZXNzaW9uQ29udGV4dC5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSwgVGVzdEVkaXRvckdyb3VwVmlldyB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25TdHViU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU0NNUmVzb3VyY2UsIElTQ01TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2NtL2NvbW1vbi9zY20uanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfRElGRl9QQU5FTF9DT05UQUlORVJfSUQgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvdXJjZXNEaWZmUGFuZWxJZHMuanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VzTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0NoYW5nZXNNb2RlbC5qcyc7XG5pbXBvcnQgeyBTb3VyY2VzQ2hhbmdlc01vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzUmVhZE1vZGVsLmpzJztcblxuc3VpdGUoJ0NvbnZlcnNhdGlvbiBkaWZmIHJldmlldyBwYW5lJywgKCkgPT4ge1xuXG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgYWNjZXB0ZWRXcml0ZTogVW5pdmVyc2VBZ2VudFdyaXRlR2l0V3JpdGVSZXN1bHQgPSB7XG5cdFx0c3VwcG9ydGVkOiB0cnVlLFxuXHRcdHJlYXNvbjogJycsXG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRlcnJvck1lc3NhZ2U6ICcnLFxuXHRcdGV4aXRDb2RlOiAwLFxuXHRcdHN0ZG91dDogJycsXG5cdH07XG5cblx0Y29uc3QgYWNjZXB0Q3Vyc29yVW5pZmllZERpZmYgPSBbXG5cdFx0J2RpZmYgLS1naXQgYS9zcmMvYS50cyBiL3NyYy9hLnRzJyxcblx0XHQnLS0tIGEvc3JjL2EudHMnLFxuXHRcdCcrKysgYi9zcmMvYS50cycsXG5cdFx0J0BAIC0xLDMgKzEsNCBAQCcsXG5cdFx0JyBsaW5lMScsXG5cdFx0Jy1vbGQnLFxuXHRcdCcrbmV3Jyxcblx0XHQnK2V4dHJhJyxcblx0XS5qb2luKCdcXG4nKTtcblxuXHRmdW5jdGlvbiBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2U6IFVSSSwgZ3JvdXBJZCA9ICd3b3JraW5nVHJlZScpOiBJU0NNU2VydmljZSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB7XG5cdFx0XHRpZDogZ3JvdXBJZCxcblx0XHRcdGxhYmVsOiBncm91cElkID09PSAnaW5kZXgnID8gJ1N0YWdlZCBDaGFuZ2VzJyA6ICdDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCBzY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiBncm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKHNjbVJlc291cmNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0ge1xuXHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0Z3JvdXBzOiBbZ3JvdXBdLFxuXHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbcmVwb3NpdG9yeV07IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBzdHViU2Vzc2lvbkFuZENoYW5nZXNNb2RlbChcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZTogUmV0dXJuVHlwZTx0eXBlb2Ygd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2U+LFxuXHRcdGNvbm5lY3Rpb246IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbixcblx0KTogdm9pZCB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQWdlbnRTZXNzaW9uQ29udGV4dCwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiAnc2Vzc2lvbi0xJyxcblx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0aXNQYWlyaW5nSG9sZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgdXNlZCcpOyB9LFxuXHRcdH0gc2F0aXNmaWVzIElBZ2VudFNlc3Npb25Db250ZXh0KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzQ2hhbmdlc01vZGVsLCBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0NoYW5nZXNNb2RlbCkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlLCB7XG5cdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiwgY29ubmVjdGlvbik7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVJbnN0YW50aWF0aW9uU2VydmljZShyZXNvdXJjZTogVVJJLCBjb25uZWN0aW9uOiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIHJlc29sdmVNb2RlbHMgPSBmYWxzZSkge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCB7XG5cdFx0XHRnZXRWaWV3TG9jYXRpb25CeUlkOiAoKSA9PiBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsXG5cdFx0XHRvbkRpZENoYW5nZUxvY2F0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0Z2V0Vmlld0Rlc2NyaXB0b3JCeUlkOiAoKSA9PiBudWxsLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkOiAoKSA9PiAoe1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX0NPTlRBSU5FUl9JRCxcblx0XHRcdFx0dGl0bGU6IHsgdmFsdWU6ICdEaWZmJywgb3JpZ2luYWw6ICdEaWZmJyB9LFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjoge30gYXMgU3luY0Rlc2NyaXB0b3I8SVZpZXdQYW5lQ29udGFpbmVyPixcblx0XHRcdH0pLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lck1vZGVsOiAoKSA9PiAoe1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbnRhaW5lckluZm86IEV2ZW50Lk5vbmUsXG5cdFx0XHR9KSxcblx0XHRcdGdldERlZmF1bHRDb250YWluZXJCeUlkOiAoKSA9PiBudWxsLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2UpKTtcblx0XHRzdHViU2Vzc2lvbkFuZENoYW5nZXNNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgY29ubmVjdGlvbik7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29tbWFuZFNlcnZpY2UsIHtcblx0XHRcdG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRFeGVjdXRlQ29tbWFuZDogRXZlbnQuTm9uZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoKSA9PiB1bmRlZmluZWQsXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb21tYW5kU2VydmljZSk7XG5cdFx0aWYgKHJlc29sdmVNb2RlbHMpIHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSURpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlLCBuZXcgVGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlKCkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVXNlckludGVyYWN0aW9uU2VydmljZSwgbmV3IE1vY2tVc2VySW50ZXJhY3Rpb25TZXJ2aWNlKCkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLCB7XG5cdFx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCwgc2hvdzogKCkgPT4gZW1wdHlQcm9ncmVzc1J1bm5lcixcblx0XHRcdFx0c2hvd1doaWxlOiBhc3luYyBwcm9taXNlID0+IHsgYXdhaXQgcHJvbWlzZTsgfSxcblx0XHRcdH0gc2F0aXNmaWVzIElFZGl0b3JQcm9ncmVzc1NlcnZpY2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCB7XG5cdFx0XHRcdGNyZWF0ZU1vZGVsUmVmZXJlbmNlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmU6IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKTogdm9pZCB7XG5cdFx0Y29uc3QgaG9zdCA9IHBhbmUgYXMgdW5rbm93biBhcyB7IGNvbXBhcmlzb25Mb2FkRmFpbGVkOiBib29sZWFuOyB1cGRhdGVSZXZpZXdBY3Rpb25zOiAoKSA9PiB2b2lkIH07XG5cdFx0aG9zdC5jb21wYXJpc29uTG9hZEZhaWxlZCA9IGZhbHNlO1xuXHRcdGhvc3QudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHR9XG5cblx0dGVzdCgnQWNjZXB0IHBvc3QtcmVhZCBhdXRob3JpemF0aW9uIGlucHV0LmRpc3Bvc2Ugd2l0aCBsaXZlIFBhbmUgYW5kIGlkZW50aWNhbCBpbnB1dCBzZW5kcyBubyBBcHBseUh1bmtzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLnBhcnNlKCdpbm1lbW9yeTovL2FjY2VwdC1pbnB1dC1kaXNwb3NlL21vZGlmaWVkJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBVUkkucGFyc2UoJ2lubWVtb3J5Oi8vYWNjZXB0LWlucHV0LWRpc3Bvc2Uvb3JpZ2luYWwnKTtcblx0XHRjb25zdCBzdGFydGVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdGNvbnN0IHJlbGVhc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4geyB2b2lkIHJlbGVhc2UuY29tcGxldGUoKTsgfSB9KTtcblx0XHRjb25zdCByZWFkczogVW5pdmVyc2VBZ2VudFJlYWRHaXRGaWxlRGlmZlJlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGFwcGxpZXM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBjb21tYW5kczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCB2YWxpZERpZmYgPSBbXG5cdFx0XHQnZGlmZiAtLWdpdCBhL3NyYy9hLnRzIGIvc3JjL2EudHMnLCAnLS0tIGEvc3JjL2EudHMnLCAnKysrIGIvc3JjL2EudHMnLFxuXHRcdFx0J0BAIC0xLDIgKzEsMiBAQCcsICcgbGluZTEnLCAnLW9sZCcsICcrbmV3Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcgYXMgY29uc3QgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHRcdHJlYWRHaXRGaWxlRGlmZjogYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0KSA9PiB7XG5cdFx0XHRcdHJlYWRzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHZvaWQgc3RhcnRlZC5jb21wbGV0ZSgpO1xuXHRcdFx0XHRhd2FpdCByZWxlYXNlLnA7XG5cdFx0XHRcdHJldHVybiB7IHN1cHBvcnRlZDogdHJ1ZSwgcmVhc29uOiAnJywgcGF0aDogcmVxdWVzdC5wYXRoLCB1bmlmaWVkRGlmZjogdmFsaWREaWZmIH07XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVHaXRBcHBseUh1bmtzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0YXBwbGllcy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXB0ZWRXcml0ZTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uID0gY3JlYXRlSW5zdGFudGlhdGlvblNlcnZpY2UocmVzb3VyY2UsIGNvbm5lY3Rpb24sIHRydWUpO1xuXHRcdGluc3RhbnRpYXRpb24uc3R1YihJQ29tbWFuZFNlcnZpY2UsIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCwgb25XaWxsRXhlY3V0ZUNvbW1hbmQ6IEV2ZW50Lk5vbmUsIG9uRGlkRXhlY3V0ZUNvbW1hbmQ6IEV2ZW50Lk5vbmUsXG5cdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgPFQ+KGlkOiBzdHJpbmcpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+ID0+IHsgY29tbWFuZHMucHVzaChpZCk7IHJldHVybiB1bmRlZmluZWQ7IH0sXG5cdFx0fSBzYXRpc2ZpZXMgSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb24uY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IG1vZGVscyA9IGluc3RhbnRpYXRpb24uZ2V0KElNb2RlbFNlcnZpY2UpO1xuXHRcdHN0b3JlLmFkZChtb2RlbHMuY3JlYXRlTW9kZWwoJ2xpbmUxXFxub2xkJywgbnVsbCwgb3JpZ2luYWwpKTtcblx0XHRzdG9yZS5hZGQobW9kZWxzLmNyZWF0ZU1vZGVsKCdsaW5lMVxcbm5ldycsIG51bGwsIHJlc291cmNlKSk7XG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSBpbnN0YW50aWF0aW9uLmdldChJVGV4dE1vZGVsU2VydmljZSk7XG5cdFx0c3RvcmUuYWRkKGF3YWl0IHJlc29sdmVyLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKG9yaWdpbmFsKSk7XG5cdFx0c3RvcmUuYWRkKGF3YWl0IHJlc29sdmVyLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHJlc291cmNlKSk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScsIHtcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsIHNlc3Npb25JZDogJ3Nlc3Npb24tMScsIGdpdFBhdGg6ICdzcmMvYS50cycsIGtpbmQ6ICdNb2RpZmllZCcsIGluZGV4U3RhdGU6ICdVbnN0YWdlZCcsXG5cdFx0fSkpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuZGlkQ29tcGFyaXNvbkxvYWRGYWlsKCksIGZhbHNlKTtcblx0XHQocGFuZSBhcyB1bmtub3duIGFzIHsgYWNjZXB0Q3Vyc29yOiB7IHNpZGU6ICduZXcnOyBsaW5lOiBudW1iZXIgfSB9KS5hY2NlcHRDdXJzb3IgPSB7IHNpZGU6ICduZXcnLCBsaW5lOiAyIH07XG5cdFx0Y29uc3Qgb3BlcmF0aW9uID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdCgpOiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW3N0YXJ0ZWQucCwgb3BlcmF0aW9uLnRoZW4oKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ0FjY2VwdCByZXR1cm5lZCBiZWZvcmUgRmlsZURpZmYgc3RhcnRlZCcpOyB9KV0pO1xuXHRcdFx0aW5wdXQuZGlzcG9zZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuaW5wdXQsIGlucHV0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dC5pc0Rpc3Bvc2VkKCksIHRydWUpO1xuXHRcdFx0YXdhaXQgcmVsZWFzZS5jb21wbGV0ZSgpO1xuXHRcdFx0YXdhaXQgb3BlcmF0aW9uO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IHJlYWRzLCBhcHBsaWVzLCBjb21tYW5kcyB9LCB7XG5cdFx0XHRcdHJlYWRzOiBbeyBzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLCBwYXRoOiAnc3JjL2EudHMnLCBpbmRleFN0YXRlOiAnVW5zdGFnZWQnIH1dLCBhcHBsaWVzOiBbXSwgY29tbWFuZHM6IFtdLFxuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHsgYXdhaXQgcmVsZWFzZS5jb21wbGV0ZSgpOyBhd2FpdCBvcGVyYXRpb247IH1cblx0fSk7XG5cblx0dGVzdCgnaW4tZmxpZ2h0IEFjY2VwdCBkb2VzIG5vdCBBcHBseUh1bmtzIGFmdGVyIGNsZWFySW5wdXQgYnVtcHMgd3JpdGUgZ2VuZXJhdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2luZmxpZ2h0LWFjY2VwdC1jbGVhci50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvaW5mbGlnaHQtYWNjZXB0LWNsZWFyLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10gPSBbXTtcblx0XHRsZXQgcmVsZWFzZVJlYWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCByZWFkR2F0ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0cmVsZWFzZVJlYWQgPSByZXNvbHZlO1xuXHRcdH0pO1xuXHRcdGxldCByZWFkSW5GbGlnaHQgPSBmYWxzZTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnIGFzIGNvbnN0IH0pLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0cmVhZEluRmxpZ2h0ID0gdHJ1ZTtcblx0XHRcdFx0YXdhaXQgcmVhZEdhdGU7XG5cdFx0XHRcdHJldHVybiB7IHN1cHBvcnRlZDogdHJ1ZSwgcmVhc29uOiAnJywgcGF0aDogJ3NyYy9hLnRzJywgdW5pZmllZERpZmY6IGFjY2VwdEN1cnNvclVuaWZpZWREaWZmIH07XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVHaXRBcHBseUh1bmtzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0YXBwbHlDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXB0ZWRXcml0ZTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUdpdFN0YWdlUGF0aHM6IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gYWNjZXB0ZWRXcml0ZTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlSW5zdGFudGlhdGlvblNlcnZpY2UocmVzb3VyY2UsIGNvbm5lY3Rpb24pO1xuXHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnLCB7XG5cdFx0XHRvcmlnaW46ICdlbmdpbmUnLFxuXHRcdFx0c2Vzc2lvbklkOiAnc2Vzc2lvbi0xJyxcblx0XHRcdGdpdFBhdGg6ICdzcmMvYS50cycsXG5cdFx0XHRpbmRleFN0YXRlOiAnVW5zdGFnZWQnLFxuXHRcdFx0a2luZDogJ01vZGlmaWVkJyxcblx0XHR9KSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXHRcdChwYW5lIGFzIHVua25vd24gYXMgeyBhY2NlcHRDdXJzb3I6IHsgc2lkZTogJ25ldyc7IGxpbmU6IG51bWJlciB9IH0pLmFjY2VwdEN1cnNvciA9IHsgc2lkZTogJ25ldycsIGxpbmU6IDMgfTtcblxuXHRcdGNvbnN0IGFjY2VwdFByb21pc2UgPSAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuQWNjZXB0OiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdHdoaWxlICghcmVhZEluRmxpZ2h0KSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cdFx0cGFuZS5jbGVhcklucHV0KCk7XG5cdFx0cmVsZWFzZVJlYWQhKCk7XG5cdFx0YXdhaXQgYWNjZXB0UHJvbWlzZTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbHlDYWxscywgW10pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsYUFBYTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUyx5Q0FBeUMsa0JBQWtCO0FBQ3BFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMscUJBQXFCLDhCQUE4QjtBQUM1RCxTQUFTLHlCQUF5QixrQ0FBa0M7QUFDcEUsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyx3QkFBNEMsNkJBQTZCO0FBQ2xGLFNBQVMsNEJBQTRCO0FBQ3JD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
