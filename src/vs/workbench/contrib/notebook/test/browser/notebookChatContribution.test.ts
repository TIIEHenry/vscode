/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { type ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IChatWidgetService, type IChatWidget } from '../../../chat/browser/chat.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from '../../common/notebookContextKeys.js';
import { NOTEBOOK_EDITOR_ID } from '../../common/notebookCommon.js';
import { INotebookKernelService } from '../../common/notebookKernelService.js';
import { NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST } from '../../browser/contrib/chat/notebookChatUtils.js';
import type { INotebookOutputActionContext } from '../../browser/controller/coreActions.js';
import { AddCellOutputToChatAction, isNotebookCellOutputChatAllowed, isNotebookKernelVariableCommandAllowed, KernelVariableContextPicker, SelectAndInsertKernelVariableAction, shouldOfferNotebookKernelVariableChat } from '../../browser/controller/chat/notebook.chat.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getMenuItem(menuId: MenuId, commandId: string) {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const outputChatReady: Record<string, ContextKeyValue> = {
	[NOTEBOOK_CELL_HAS_OUTPUTS.key]: true,
	[NOTEBOOK_CELL_OUTPUT_MIMETYPE.key]: 'text/plain',
	[NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.key]: NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST,
	[ChatContextKeys.enabled.key]: true,
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...outputChatReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...outputChatReady,
	[IsSessionsWindowContext.key]: true,
};

suite('NotebookChatContribution - default window chrome (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Add Cell Output to Chat menu item', () => {
		const item = getMenuItem(MenuId.NotebookOutputToolbar, 'notebook.cellOutput.addToChat');
		assert.ok(item, 'Add Cell Output to Chat should remain registered for Agents Window');
		assert.ok(item.when, 'menu item should have a when clause');
		assert.ok(item.command.precondition, 'menu item should have a command precondition');

		assert.strictEqual(
			evalWhen(item.when, defaultWindow),
			false,
			'default Code window must hide Add Cell Output to Chat (menu when)'
		);
		assert.strictEqual(
			evalWhen(item.command.precondition, defaultWindow),
			false,
			'default Code window must hide Add Cell Output to Chat (precondition)'
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindow),
			true,
			'Agents Window may show Add Cell Output to Chat (menu when)'
		);
		assert.strictEqual(
			evalWhen(item.command.precondition, agentsWindow),
			true,
			'Agents Window may show Add Cell Output to Chat (precondition)'
		);
	});

	test('default Code window does not offer or run notebook kernel variable chat', async () => {
		const defaultContext = contextKeyService(false);
		const agentsContext = contextKeyService(true);
		const notebookWidget = { location: ChatAgentLocation.Notebook } as IChatWidget;
		const panelWidget = { location: ChatAgentLocation.Chat } as IChatWidget;

		assert.strictEqual(isNotebookKernelVariableCommandAllowed(defaultContext), false);
		assert.strictEqual(isNotebookKernelVariableCommandAllowed(agentsContext), true);
		assert.strictEqual(shouldOfferNotebookKernelVariableChat(ChatAgentLocation.Notebook, defaultContext), false);
		assert.strictEqual(shouldOfferNotebookKernelVariableChat(ChatAgentLocation.Notebook, agentsContext), true);
		assert.strictEqual(shouldOfferNotebookKernelVariableChat(ChatAgentLocation.Chat, agentsContext), false);

		const hiddenPicker = new KernelVariableContextPicker(notebookEditorService(), {} as INotebookKernelService, defaultContext);
		assert.strictEqual(hiddenPicker.isEnabled(notebookWidget), false);

		const agentsPicker = new KernelVariableContextPicker(notebookEditorService(), {} as INotebookKernelService, agentsContext);
		assert.strictEqual(agentsPicker.isEnabled(notebookWidget), true);
		assert.strictEqual(agentsPicker.isEnabled(panelWidget), false);

		const action = new SelectAndInsertKernelVariableAction();
		await action.run(accessorFor(defaultContext, () => {
			throw new Error('default Code window must not resolve notebook services for kernel variable insert');
		}));

		let sawEditor = false;
		await action.run(accessorFor(agentsContext, (id) => {
			if (id === IEditorService) {
				sawEditor = true;
				return { activeEditorPane: undefined };
			}
			if (id === INotebookKernelService || id === IQuickInputService) {
				return {};
			}
			throw new Error(`unexpected service ${String(id)}`);
		}));
		assert.strictEqual(sawEditor, true);
	});

	test('cell output chat is allowed only in the Agents window', () => {
		assert.strictEqual(isNotebookCellOutputChatAllowed(contextKeyService(false)), false);
		assert.strictEqual(isNotebookCellOutputChatAllowed(contextKeyService(true)), true);
	});

	test('default Code window does not reveal chat or attach cell output', async () => {
		const probe = outputChatProbe();
		await new AddCellOutputToChatAction().run(outputChatAccessor(false, probe), outputAttachmentContext());

		assert.strictEqual(probe.reveals, 0);
		assert.strictEqual(probe.focused, 0);
		assert.deepStrictEqual(probe.added, []);
	});

	test('Agents window still reveals chat and attaches cell output', async () => {
		const probe = outputChatProbe();
		await new AddCellOutputToChatAction().run(outputChatAccessor(true, probe), outputAttachmentContext());

		assert.strictEqual(probe.editorGets, 1);
		assert.strictEqual(probe.reveals, 2);
		assert.strictEqual(probe.focused, 1);
		assert.strictEqual(probe.added.length, 1);
		const attached = probe.added[0] as { kind?: string; mimeType?: string };
		assert.strictEqual(attached.kind, 'notebookOutput');
		assert.strictEqual(attached.mimeType, 'text/plain');
	});
});

function contextKeyService(isSessionsWindow: boolean): IContextKeyService {
	return {
		getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
	} as IContextKeyService;
}

function notebookEditorService(): IEditorService {
	return {
		activeEditorPane: {
			getId: () => NOTEBOOK_EDITOR_ID,
			getControl: () => ({
				getViewModel: () => ({ notebookDocument: { uri: 'notebook' } }),
			}),
		},
	} as unknown as IEditorService;
}

interface IOutputChatProbe {
	readonly reveals: number;
	readonly focused: number;
	readonly editorGets: number;
	readonly added: readonly unknown[];
	markEditor(): void;
}

function outputAttachmentContext(): INotebookOutputActionContext {
	const outputViewModel = {
		pickedMimeType: { mimeType: 'text/plain' },
		cellViewModel: { handle: 7 },
		model: { outputId: 'out-1' },
	};
	const cellModel = {};
	const cell = {
		uri: URI.from({ scheme: 'vscode-notebook-cell', path: '/nb.ipynb', fragment: 'W0' }),
		model: cellModel,
		outputsViewModels: [outputViewModel],
	};
	return {
		cell,
		outputViewModel,
		notebookEditor: {
			textModel: {
				uri: URI.file('/tmp/nb.ipynb'),
				cells: [cellModel],
			},
			getCellByHandle: () => cell,
		},
	} as unknown as INotebookOutputActionContext;
}

function outputChatProbe(): IOutputChatProbe & { service: { revealWidget(): Promise<unknown> } } {
	let reveals = 0;
	let focused = 0;
	let editorGets = 0;
	const added: unknown[] = [];
	const widget = {
		attachmentModel: {
			addContext(entry: unknown) { added.push(entry); },
		},
		focusInput() { focused++; },
	};
	const probe = {
		added,
		get reveals() { return reveals; },
		get focused() { return focused; },
		get editorGets() { return editorGets; },
		service: {
			async revealWidget() {
				reveals++;
				return widget;
			},
		},
		markEditor() { editorGets++; },
	};
	return probe;
}

function outputChatAccessor(isSessionsWindow: boolean, probe: ReturnType<typeof outputChatProbe>): ServicesAccessor {
	return accessorFor(contextKeyService(isSessionsWindow), (id) => {
		if (id === IEditorService) {
			probe.markEditor();
			return { activeEditorPane: undefined };
		}
		if (id === IChatWidgetService) {
			return probe.service;
		}
		throw new Error(`unexpected service ${String(id)}`);
	});
}

function accessorFor(contextKeyService: IContextKeyService, getOther: (id: unknown) => unknown): ServicesAccessor {
	return {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return contextKeyService;
			}
			return getOther(id);
		},
	} as ServicesAccessor;
}
