/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import * as dom from "../../../../../../base/browser/dom.js";
import { Event } from "../../../../../../base/common/event.js";
import { URI } from "../../../../../../base/common/uri.js";
import { mock } from "../../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../../platform/theme/test/common/testThemeService.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { IBrowserViewWorkbenchService } from "../../../../browserView/common/browserView.js";
import { ChatAttachmentModel } from "../../../browser/attachments/chatAttachmentModel.js";
import { ChatImplicitContexts } from "../../../browser/attachments/chatImplicitContext.js";
import { ImplicitContextAttachmentWidget } from "../../../browser/attachments/implicitContextAttachment.js";
import { IChatContextService } from "../../../browser/contextContrib/chatContextService.js";
import { StringChatContextValue } from "../../../common/attachments/chatVariableEntries.js";
import { workbenchInstantiationService } from "../../../../../test/browser/workbenchTestServices.js";

suite("ImplicitContextAttachmentWidget", () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test("cleans up previous implicit context DOM nodes on color theme change", () => {
		const themeService = new TestThemeService();
		const instantiationService = workbenchInstantiationService(undefined, store) as TestInstantiationService;
		instantiationService.stub(IThemeService, themeService);
		instantiationService.stub(IChatContextService, new class extends mock<IChatContextService>() { }());
		instantiationService.stub(IBrowserViewWorkbenchService, new class extends mock<IBrowserViewWorkbenchService>() { }());

		const container = dom.$(".attached-context-container");
		const regularAttachment = dom.$(".chat-attached-context-attachment.regular");
		container.appendChild(regularAttachment);

		const attachmentModel = store.add(new ChatAttachmentModel(null!, null!, null!));
		const resourceLabels = store.add(instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const implicitContexts = store.add(new ChatImplicitContexts());

		const dualPathContextValue: StringChatContextValue = {
			handle: 1,
			name: "dual-icon-context",
			uri: URI.file("/workspace/file.ts"),
			iconPath: {
				light: URI.file("/icons/light.png"),
				dark: URI.file("/icons/dark.png"),
			},
		};
		implicitContexts.setValues([{ value: dualPathContextValue, isSelection: false }]);

		store.add(instantiationService.createInstance(
			ImplicitContextAttachmentWidget,
			() => undefined,
			() => false,
			implicitContexts,
			resourceLabels,
			attachmentModel,
			container,
		));

		const initialImplicitChip = container.querySelector(".chat-attached-context-attachment.implicit");
		assert.ok(initialImplicitChip);
		assert.strictEqual(container.querySelectorAll(".chat-attached-context-attachment.implicit").length, 1);
		assert.strictEqual(container.contains(regularAttachment), true);

		// Trigger theme change
		themeService.fireThemeChange();

		// Should still only have 1 implicit chip, not duplicate, and regular attachment remains
		const implicitChips = container.querySelectorAll(".chat-attached-context-attachment.implicit");
		assert.strictEqual(implicitChips.length, 1);
		assert.strictEqual(container.contains(initialImplicitChip), false);
		assert.strictEqual(container.contains(regularAttachment), true);
	});
});
