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
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { DefaultChatAttachmentWidget } from "../../../browser/attachments/chatAttachmentWidgets.js";
import { IChatContextService } from "../../../browser/contextContrib/chatContextService.js";
import { IChatRequestVariableEntry } from "../../../common/attachments/chatVariableEntries.js";
import { workbenchInstantiationService } from "../../../../../test/browser/workbenchTestServices.js";

suite("DefaultChatAttachmentWidget - click bubbling", () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test("stops click propagation on diagnostic, commandId and debugEvents attachments", () => {
		const executedCommands: string[] = [];
		const executedContextCommands: number[] = [];

		const instantiationService = workbenchInstantiationService(undefined, store) as TestInstantiationService;
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
			override async executeCommand(id: string) {
				executedCommands.push(id);
				return undefined;
			}
		}());
		instantiationService.stub(IChatContextService, new class extends mock<IChatContextService>() {
			override async executeChatContextItemCommand(handle: number) {
				executedContextCommands.push(handle);
			}
		}());

		const resourceLabels = store.add(instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const attachmentsContainer = dom.$(".chat-attached-context-container");

		let focusCallCount = 0;
		store.add(dom.addStandardDisposableListener(attachmentsContainer, dom.EventType.CLICK, () => {
			focusCallCount++;
		}));

		// 1. Diagnostic attachment without filterUri
		const diagAttachment: IChatRequestVariableEntry = {
			id: "diag-1",
			name: "Diagnostic item",
			kind: "diagnostic",
			value: "diagnostics",
		};
		const diagWidget = store.add(instantiationService.createInstance(
			DefaultChatAttachmentWidget,
			undefined,
			undefined,
			diagAttachment,
			undefined,
			undefined,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			attachmentsContainer,
			resourceLabels,
		));

		diagWidget.element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.strictEqual(focusCallCount, 0, "Diagnostic click must not bubble to container");
		assert.ok(executedCommands.includes("workbench.panel.markers.view.focus"));

		// 2. String variable with commandId
		const stringCmdAttachment: IChatRequestVariableEntry = {
			id: "str-cmd",
			name: "String with command",
			kind: "string",
			value: "string-value",
			handle: 42,
			commandId: "test.command.id",
			uri: URI.file("/string-cmd"),
		};
		const stringWidget = store.add(instantiationService.createInstance(
			DefaultChatAttachmentWidget,
			undefined,
			undefined,
			stringCmdAttachment,
			undefined,
			undefined,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			attachmentsContainer,
			resourceLabels,
		));

		stringWidget.element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.strictEqual(focusCallCount, 0, "String with commandId click must not bubble to container");
		assert.deepStrictEqual(executedContextCommands, [42]);

		// 3. Debug events attachment
		const debugEventsAttachment: IChatRequestVariableEntry = {
			id: "debug-1",
			name: "Debug Events",
			kind: "debugEvents",
			value: "debug-events",
			snapshotTime: Date.now(),
			sessionResource: URI.file("/session"),
		};
		const debugWidget = store.add(instantiationService.createInstance(
			DefaultChatAttachmentWidget,
			undefined,
			undefined,
			debugEventsAttachment,
			undefined,
			undefined,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			attachmentsContainer,
			resourceLabels,
		));

		debugWidget.element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.strictEqual(focusCallCount, 0, "Debug events click must not bubble to container");
		assert.ok(executedCommands.includes("workbench.action.chat.openAgentDebugPanelForSession"));

		// 4. Clicking outside the chips on the attachmentsContainer itself
		attachmentsContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.strictEqual(focusCallCount, 1, "Click on container outside chips must bubble and invoke focus");
	});
});
