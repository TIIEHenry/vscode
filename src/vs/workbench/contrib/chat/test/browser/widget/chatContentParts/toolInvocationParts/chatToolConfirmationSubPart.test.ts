/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { mainWindow } from "../../../../../../../../base/browser/window.js";
import { MarkdownString } from "../../../../../../../../base/common/htmlContent.js";
import { observableValue } from "../../../../../../../../base/common/observable.js";
import { URI } from "../../../../../../../../base/common/uri.js";
import { mock } from "../../../../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../../base/test/common/utils.js";
import { toDisposable } from "../../../../../../../../base/common/lifecycle.js";
import { IModelService } from "../../../../../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../../../../../editor/common/languages/language.js";
import { IMarkerService } from "../../../../../../../../platform/markers/common/markers.js";
import { ICommandService } from "../../../../../../../../platform/commands/common/commands.js";
import { IMarkdownRenderer } from "../../../../../../../../platform/markdown/browser/markdownRenderer.js";
import { workbenchInstantiationService } from "../../../../../../../test/browser/workbenchTestServices.js";
import { TestInstantiationService } from "../../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IChatToolInvocation } from "../../../../../common/chatService/chatService.js";
import { IChatResponseViewModel } from "../../../../../common/model/chatViewModel.js";
import { IChatContentPartRenderContext } from "../../../../../browser/widget/chatContentParts/chatContentParts.js";
import { ToolConfirmationSubPart } from "../../../../../browser/widget/chatContentParts/toolInvocationParts/chatToolConfirmationSubPart.js";
import { ILanguageModelToolsConfirmationService } from "../../../../../common/tools/languageModelToolsConfirmationService.js";
import { ILanguageModelToolsService, ToolDataSource } from "../../../../../common/tools/languageModelToolsService.js";
import { IChatToolRiskAssessmentService } from "../../../../../browser/tools/chatToolRiskAssessmentService.js";
import { IChatMarkdownAnchorService, ChatMarkdownAnchorService } from "../../../../../browser/widget/chatContentParts/chatMarkdownAnchorService.js";
import { IChatWidgetService } from "../../../../../browser/chat.js";
import { EditorPool } from "../../../../../browser/widget/chatContentParts/chatContentCodePools.js";
import { IDisposableReference } from "../../../../../browser/widget/chatContentParts/chatCollections.js";
import { CodeBlockPart } from "../../../../../browser/widget/chatContentParts/codeBlockPart.js";
import { ChatContentMarkdownRenderer } from "../../../../../browser/widget/chatContentMarkdownRenderer.js";
import { IChatOutputRendererService } from "../../../../../browser/chatOutputItemRenderer.js";
import { IChatSessionsService } from "../../../../../common/chatSessionsService.js";
import { MockChatSessionsService } from "../../../../../test/common/mockChatSessionsService.js";
import { IAiEditTelemetryService } from "../../../../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { ILinkPresentationService } from "../../../../../../../../platform/dataChannel/common/dataChannel.js";

suite("ToolConfirmationSubPart", () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test("retains See more link when JSON is invalid and expands when JSON is valid", async () => {
		const instantiationService = workbenchInstantiationService(undefined, store) as TestInstantiationService;
		const modelService = instantiationService.get(IModelService);
		const languageService = instantiationService.get(ILanguageService);

		instantiationService.stub(ILanguageModelToolsService, new class extends mock<ILanguageModelToolsService>() {
			override getTool() { return undefined; }
		}());
		instantiationService.stub(ILanguageModelToolsConfirmationService, new class extends mock<ILanguageModelToolsConfirmationService>() {
			override getPreConfirmActions() { return []; }
		}());
		instantiationService.stub(IChatToolRiskAssessmentService, new class extends mock<IChatToolRiskAssessmentService>() {
			override isEnabled() { return false; }
			getRiskAssessment() { return undefined; }
		}());
		instantiationService.stub(IChatMarkdownAnchorService, store.add(new ChatMarkdownAnchorService()));
		instantiationService.stub(IChatWidgetService, new class extends mock<IChatWidgetService>() {
			getWidgetBySessionId() { return undefined; }
		}());
		instantiationService.stub(IMarkerService, new class extends mock<IMarkerService>() {
			override changeOne() { }
			override remove() { }
		}());
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
			override async executeCommand<T = any>(commandId: string, ...args: any[]): Promise<T | undefined> { return [] as any; }
		}());
		instantiationService.stub(IChatOutputRendererService, new class extends mock<IChatOutputRendererService>() { }());
		instantiationService.stub(IChatSessionsService, new MockChatSessionsService());
		instantiationService.stub(IAiEditTelemetryService, new class extends mock<IAiEditTelemetryService>() { }());
		instantiationService.stub(ILinkPresentationService, new class extends mock<ILinkPresentationService>() { }());

		const renderer: IMarkdownRenderer = instantiationService.createInstance(ChatContentMarkdownRenderer);

		const testModelUri = URI.file("/test-tool-confirmation.json");
		const textModel = store.add(modelService.createModel("{}", languageService.createById("json"), testModelUri));

		let updatedOptions: Record<string, any> = {};
		const mockEditorPart = {
			element: mainWindow.document.createElement("div"),
			editor: {
				getModel: () => textModel,
				updateOptions: (options: Record<string, any>) => {
					Object.assign(updatedOptions, options);
				},
			},
			render: () => { },
			focus: () => { },
			layout: () => { },
			reset: () => { },
		} as unknown as CodeBlockPart;

		const editorPool = {
			get: (): IDisposableReference<CodeBlockPart> => ({
				object: mockEditorPart,
				isStale: () => false,
				dispose: () => { },
			}),
			inUse: () => [],
			dispose: () => { },
		} as unknown as EditorPool;

		const state = observableValue("state", {
			type: IChatToolInvocation.StateKind.WaitingForConfirmation,
			confirmationMessages: {
				title: "Confirm Tool",
				message: new MarkdownString("Tool details"),
			},
			parameters: {},
		});

		const toolInvocation: Partial<IChatToolInvocation> = {
			kind: "toolInvocation",
			toolId: "test-tool",
			source: ToolDataSource.Internal,
			state: state as any,
			toolSpecificData: {
				kind: "input",
				rawInput: {
					param1: "value1",
					param2: "value2",
					param3: "value3",
				},
			},
		};

		const mockElement: Partial<IChatResponseViewModel> = {
			id: "element-1",
			sessionResource: URI.file("/session-resource"),
		};

		const context: IChatContentPartRenderContext = {
			element: mockElement as IChatResponseViewModel,
			container: mainWindow.document.createElement("div"),
			content: [{ kind: "markdownContent", content: new MarkdownString("") }],
			contentIndex: 0,
		} as unknown as IChatContentPartRenderContext;

		const subPart = store.add(instantiationService.createInstance(
			ToolConfirmationSubPart,
			toolInvocation as IChatToolInvocation,
			context,
			renderer,
			editorPool,
			() => 500,
			0,
		));

		const seeMoreLink = subPart.domNode.querySelector<HTMLAnchorElement>(".editor .see-more a");
		assert.ok(seeMoreLink, "See more link must be rendered");

		// Test 1: When model has invalid JSON, clicking See more keeps the link and does not change text
		mainWindow.document.body.appendChild(subPart.domNode);
		store.add(toDisposable(() => subPart.domNode.remove()));
		textModel.setValue("{ invalid json");
		seeMoreLink.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		
		assert.strictEqual(textModel.getValue(), "{ invalid json");
		assert.ok(subPart.domNode.querySelector(".editor .see-more a"), "See more link must still exist after invalid JSON parse");
		assert.strictEqual(seeMoreLink.title, "Invalid JSON");
		assert.strictEqual(updatedOptions.wordWrap, undefined);

		// Test 2: When model has valid JSON, clicking See more pretty-prints with 2 spaces and removes the link
		textModel.setValue(JSON.stringify({ param1: "value1", param2: "value2", param3: "value3" }));
		seeMoreLink.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

		assert.strictEqual(textModel.getValue(), JSON.stringify({ param1: "value1", param2: "value2", param3: "value3" }, null, 2));
		assert.strictEqual(updatedOptions.wordWrap, "on");
		assert.strictEqual(updatedOptions.tabFocusMode, false);
		assert.strictEqual(subPart.domNode.querySelector(".editor .see-more a"), null, "See more link must be removed after successful expansion");
	});
});
