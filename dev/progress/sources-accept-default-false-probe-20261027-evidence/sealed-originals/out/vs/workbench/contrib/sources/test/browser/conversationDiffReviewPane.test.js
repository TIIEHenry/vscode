import assert from "assert";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
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
  function createInstantiationService(resource, connection) {
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
    instantiationService.stub(ITextModelService, {
      createModelReference: async () => {
        throw new Error("boom");
      }
    });
    return instantiationService;
  }
  function paintReviewWriteChrome(pane) {
    const host = pane;
    host.comparisonLoadFailed = false;
    host.updateReviewActions();
  }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvdGVzdC9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUsIHRvUmVzb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHR5cGUgeyBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdCwgVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3QsIFVuaXZlcnNlQWdlbnRXcml0ZUdpdFdyaXRlUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudFR5cGVzLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIElWaWV3UGFuZUNvbnRhaW5lciwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElBZ2VudFNlc3Npb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvYWdlbnRTZXNzaW9uL2NvbW1vbi9hZ2VudFNlc3Npb25Db250ZXh0LmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0RWRpdG9yR3JvdXBWaWV3IH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvblN0dWJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTQ01SZXNvdXJjZSwgSVNDTVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zY20vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dC5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUuanMnO1xuaW1wb3J0IHsgU09VUkNFU19ESUZGX1BBTkVMX0NPTlRBSU5FUl9JRCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc291cmNlc0RpZmZQYW5lbElkcy5qcyc7XG5pbXBvcnQgeyBJU291cmNlc0NoYW5nZXNNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlc01vZGVsLmpzJztcbmltcG9ydCB7IFNvdXJjZXNDaGFuZ2VzTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0NoYW5nZXNSZWFkTW9kZWwuanMnO1xuXG5zdWl0ZSgnQ29udmVyc2F0aW9uIGRpZmYgcmV2aWV3IHBhbmUnLCAoKSA9PiB7XG5cblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBhY2NlcHRlZFdyaXRlOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0cmVhc29uOiAnJyxcblx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdGVycm9yTWVzc2FnZTogJycsXG5cdFx0ZXhpdENvZGU6IDAsXG5cdFx0c3Rkb3V0OiAnJyxcblx0fTtcblxuXHRjb25zdCBhY2NlcHRDdXJzb3JVbmlmaWVkRGlmZiA9IFtcblx0XHQnZGlmZiAtLWdpdCBhL3NyYy9hLnRzIGIvc3JjL2EudHMnLFxuXHRcdCctLS0gYS9zcmMvYS50cycsXG5cdFx0JysrKyBiL3NyYy9hLnRzJyxcblx0XHQnQEAgLTEsMyArMSw0IEBAJyxcblx0XHQnIGxpbmUxJyxcblx0XHQnLW9sZCcsXG5cdFx0JytuZXcnLFxuXHRcdCcrZXh0cmEnLFxuXHRdLmpvaW4oJ1xcbicpO1xuXG5cdGZ1bmN0aW9uIGNyZWF0ZUxlZnRvdmVyU2NtU2VydmljZShyZXNvdXJjZTogVVJJLCBncm91cElkID0gJ3dvcmtpbmdUcmVlJyk6IElTQ01TZXJ2aWNlIHtcblx0XHRjb25zdCBncm91cCA9IHtcblx0XHRcdGlkOiBncm91cElkLFxuXHRcdFx0bGFiZWw6IGdyb3VwSWQgPT09ICdpbmRleCcgPyAnU3RhZ2VkIENoYW5nZXMnIDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IHNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IGdyb3VwLFxuXHRcdFx0ZGVjb3JhdGlvbnM6IHt9LFxuXHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0Z3JvdXAucmVzb3VyY2VzLnB1c2goc2NtUmVzb3VyY2UpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB7XG5cdFx0XHRwcm92aWRlcjoge1xuXHRcdFx0XHRncm91cHM6IFtncm91cF0sXG5cdFx0XHRcdHJvb3RVcmk6IHJlc291cmNlLFxuXHRcdFx0XHRvbkRpZENoYW5nZVJlc291cmNlczogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IHJlcG9zaXRvcmllcygpIHsgcmV0dXJuIFtyZXBvc2l0b3J5XTsgfSxcblx0XHRcdGdldCByZXBvc2l0b3J5Q291bnQoKSB7IHJldHVybiAxOyB9LFxuXHRcdFx0b25EaWRBZGRSZXBvc2l0b3J5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRSZW1vdmVSZXBvc2l0b3J5OiBFdmVudC5Ob25lLFxuXHRcdFx0cmVnaXN0ZXJTQ01Qcm92aWRlcjogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9LFxuXHRcdFx0Z2V0UmVwb3NpdG9yeTogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNU2VydmljZTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0dWJTZXNzaW9uQW5kQ2hhbmdlc01vZGVsKFxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlOiBSZXR1cm5UeXBlPHR5cGVvZiB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZT4sXG5cdFx0Y29ubmVjdGlvbjogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uLFxuXHQpOiB2b2lkIHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElBZ2VudFNlc3Npb25Db250ZXh0LCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRpc1BhaXJpbmdIb2xkOiAoKSA9PiBmYWxzZSxcblx0XHRcdG9uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbjogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlU2Vzc2lvbjogRXZlbnQuTm9uZSxcblx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCB1c2VkJyk7IH0sXG5cdFx0fSBzYXRpc2ZpZXMgSUFnZW50U2Vzc2lvbkNvbnRleHQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNDaGFuZ2VzTW9kZWwsIHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzQ2hhbmdlc01vZGVsKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UsIHtcblx0XHRcdGdldEFjdGl2ZVNlc3Npb25JZDogKCkgPT4gJ3Nlc3Npb24tMScsXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uLCBjb25uZWN0aW9uKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZUluc3RhbnRpYXRpb25TZXJ2aWNlKHJlc291cmNlOiBVUkksIGNvbm5lY3Rpb246IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbikge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCB7XG5cdFx0XHRnZXRWaWV3TG9jYXRpb25CeUlkOiAoKSA9PiBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsXG5cdFx0XHRvbkRpZENoYW5nZUxvY2F0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0Z2V0Vmlld0Rlc2NyaXB0b3JCeUlkOiAoKSA9PiBudWxsLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkOiAoKSA9PiAoe1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX0NPTlRBSU5FUl9JRCxcblx0XHRcdFx0dGl0bGU6IHsgdmFsdWU6ICdEaWZmJywgb3JpZ2luYWw6ICdEaWZmJyB9LFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjoge30gYXMgU3luY0Rlc2NyaXB0b3I8SVZpZXdQYW5lQ29udGFpbmVyPixcblx0XHRcdH0pLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lck1vZGVsOiAoKSA9PiAoe1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbnRhaW5lckluZm86IEV2ZW50Lk5vbmUsXG5cdFx0XHR9KSxcblx0XHRcdGdldERlZmF1bHRDb250YWluZXJCeUlkOiAoKSA9PiBudWxsLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2UpKTtcblx0XHRzdHViU2Vzc2lvbkFuZENoYW5nZXNNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgY29ubmVjdGlvbik7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29tbWFuZFNlcnZpY2UsIHtcblx0XHRcdG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRFeGVjdXRlQ29tbWFuZDogRXZlbnQuTm9uZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoKSA9PiB1bmRlZmluZWQsXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb21tYW5kU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGV4dE1vZGVsU2VydmljZSwge1xuXHRcdFx0Y3JlYXRlTW9kZWxSZWZlcmVuY2U6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVGV4dE1vZGVsU2VydmljZSk7XG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSk6IHZvaWQge1xuXHRcdGNvbnN0IGhvc3QgPSBwYW5lIGFzIHVua25vd24gYXMgeyBjb21wYXJpc29uTG9hZEZhaWxlZDogYm9vbGVhbjsgdXBkYXRlUmV2aWV3QWN0aW9uczogKCkgPT4gdm9pZCB9O1xuXHRcdGhvc3QuY29tcGFyaXNvbkxvYWRGYWlsZWQgPSBmYWxzZTtcblx0XHRob3N0LnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0fVxuXG5cdHRlc3QoJ2luLWZsaWdodCBBY2NlcHQgZG9lcyBub3QgQXBwbHlIdW5rcyBhZnRlciBjbGVhcklucHV0IGJ1bXBzIHdyaXRlIGdlbmVyYXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9pbmZsaWdodC1hY2NlcHQtY2xlYXIudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2luZmxpZ2h0LWFjY2VwdC1jbGVhci50cy5naXQnKTtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0bGV0IHJlbGVhc2VSZWFkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVhZEdhdGUgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdHJlbGVhc2VSZWFkID0gcmVzb2x2ZTtcblx0XHR9KTtcblx0XHRsZXQgcmVhZEluRmxpZ2h0ID0gZmFsc2U7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJyBhcyBjb25zdCB9KSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlYWRJbkZsaWdodCA9IHRydWU7XG5cdFx0XHRcdGF3YWl0IHJlYWRHYXRlO1xuXHRcdFx0XHRyZXR1cm4geyBzdXBwb3J0ZWQ6IHRydWUsIHJlYXNvbjogJycsIHBhdGg6ICdzcmMvYS50cycsIHVuaWZpZWREaWZmOiBhY2NlcHRDdXJzb3JVbmlmaWVkRGlmZiB9O1xuXHRcdFx0fSxcblx0XHRcdHdyaXRlR2l0QXBwbHlIdW5rczogYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0KSA9PiB7XG5cdFx0XHRcdGFwcGx5Q2FsbHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0cmV0dXJuIGFjY2VwdGVkV3JpdGU7XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVHaXRTdGFnZVBhdGhzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0cmV0dXJuIGFjY2VwdGVkV3JpdGU7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZUluc3RhbnRpYXRpb25TZXJ2aWNlKHJlc291cmNlLCBjb25uZWN0aW9uKTtcblx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJywge1xuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2EudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyxcblx0XHRcdGtpbmQ6ICdNb2RpZmllZCcsXG5cdFx0fSkpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHQocGFuZSBhcyB1bmtub3duIGFzIHsgYWNjZXB0Q3Vyc29yOiB7IHNpZGU6ICduZXcnOyBsaW5lOiBudW1iZXIgfSB9KS5hY2NlcHRDdXJzb3IgPSB7IHNpZGU6ICduZXcnLCBsaW5lOiAzIH07XG5cblx0XHRjb25zdCBhY2NlcHRQcm9taXNlID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHR3aGlsZSAoIXJlYWRJbkZsaWdodCkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXHRcdHBhbmUuY2xlYXJJbnB1dCgpO1xuXHRcdHJlbGVhc2VSZWFkISgpO1xuXHRcdGF3YWl0IGFjY2VwdFByb21pc2U7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWE7QUFFdEIsU0FBUyx5Q0FBeUMsa0JBQWtCO0FBQ3BFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsd0JBQTRDLDZCQUE2QjtBQUNsRixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLCtCQUErQiwyQkFBMkI7QUFDbkUsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBdUIsbUJBQW1CO0FBQzFDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsMkJBQTJCO0FBRXBDLE1BQU0saUNBQWlDLE1BQU07QUFFNUMsUUFBTSxRQUFRLHdDQUF3QztBQUV0RCxRQUFNLGdCQUFrRDtBQUFBLElBQ3ZELFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLFNBQVM7QUFBQSxJQUNULGNBQWM7QUFBQSxJQUNkLFVBQVU7QUFBQSxJQUNWLFFBQVE7QUFBQSxFQUNUO0FBRUEsUUFBTSwwQkFBMEI7QUFBQSxJQUMvQjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNELEVBQUUsS0FBSyxJQUFJO0FBRVgsV0FBUyx5QkFBeUIsVUFBZSxVQUFVLGVBQTRCO0FBQ3RGLFVBQU0sUUFBUTtBQUFBLE1BQ2IsSUFBSTtBQUFBLE1BQ0osT0FBTyxZQUFZLFVBQVUsbUJBQW1CO0FB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
